import { CUSTOMER_PARTNER_ACCOUNT_INDEX } from '@constants/customer';
import type {
  CreateCustomerPayload,
  CustomerResponse,
  DeletedCustomerResponse,
  FindCustomersQuery,
  UpdateCustomerPayload,
} from '@contracts/customers.types';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import { TaxExemptEnum } from '@contracts/taxes.types';
import type { Customer } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import { isUniqueViolation, isUniqueViolationOf } from '@errors/database.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class CustomerService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createCustomer(payload: CreateCustomerPayload): Promise<CustomerResponse> {
    CustomerService.assertPartnerPair(payload);

    if (this.canAttachTestClock(payload.testClockId)) {
      const now = this.fastify.clock.now().toISOString();

      const id = generateGid(ObjectPrefixEnum.CUSTOMER);

      return this.writeCustomer(id, payload, now);
    }

    throw new BadRequestError('Test clocks are disabled in this environment', {
      param: 'testClockId',
    });
  }

  private canAttachTestClock(testClockId: string | undefined): boolean {
    if (testClockId) {
      return this.fastify.testClockService.isEnabled;
    }

    return true;
  }

  private async writeCustomer(
    id: string,
    payload: CreateCustomerPayload,
    now: string,
  ): Promise<Customer> {
    const {
      name = '',
      description = '',
      phone = '',
      taxExempt = TaxExemptEnum.NONE,
      metadata = {},
    } = payload;

    try {
      return await this.fastify.database.master.transaction(async (tx) => {
        const customer = await this.fastify.customerRepository.createCustomer(
          {
            id,
            email: payload.email ?? null,
            name,
            description,
            phone,
            taxId: payload.taxId ?? null,
            taxExempt,
            address: payload.address ?? null,
            currency: payload.currency,
            defaultPaymentMethodId: payload.defaultPaymentMethodId ?? null,
            testClockId: payload.testClockId ?? null,
            partnerPlatform: payload.partnerPlatform ?? null,
            partnerAccountId: payload.partnerAccountId ?? null,
            metadata,
            createdAt: now,
            updatedAt: now,
          },
          tx,
        );

        if (customer) {
          await this.fastify.outboxService.recordEvents(
            [
              {
                aggregateType: AggregateTypeEnum.CUSTOMER,
                aggregateId: customer.id,
                eventType: DomainEventTypeEnum.CUSTOMER_CREATED,
                payload: { id: customer.id },
              },
            ],
            tx,
          );

          return customer;
        }

        throw new NotFoundError(`Customer ${id} could not be created`);
      });
    } catch (error) {
      if (isUniqueViolationOf(error, CUSTOMER_PARTNER_ACCOUNT_INDEX)) {
        throw CustomerService.buildPartnerConflictError(payload, error);
      }

      if (isUniqueViolation(error)) {
        throw new ConflictError(`A customer with email ${payload.email} already exists`, {
          param: 'email',
          cause: error,
        });
      }

      throw error;
    }
  }

  async getCustomer(id: string): Promise<CustomerResponse> {
    return this.fastify.customerRepository.getCustomer(id);
  }

  async updateCustomer(id: string, payload: UpdateCustomerPayload): Promise<CustomerResponse> {
    CustomerService.assertPartnerPair(payload);

    await this.getCustomer(id);

    try {
      return await this.writeCustomerUpdate(id, payload);
    } catch (error) {
      if (isUniqueViolationOf(error, CUSTOMER_PARTNER_ACCOUNT_INDEX)) {
        throw CustomerService.buildPartnerConflictError(payload, error);
      }

      throw error;
    }
  }

  private async writeCustomerUpdate(id: string, payload: UpdateCustomerPayload): Promise<Customer> {
    return this.fastify.database.master.transaction(async (tx) => {
      const customer = await this.fastify.customerRepository.updateCustomer(
        id,
        { ...payload, updatedAt: this.fastify.clock.now().toISOString() },
        tx,
      );

      if (customer) {
        await this.fastify.outboxService.recordEvents(
          [
            {
              aggregateType: AggregateTypeEnum.CUSTOMER,
              aggregateId: customer.id,
              eventType: DomainEventTypeEnum.CUSTOMER_UPDATED,
              payload: { id: customer.id },
            },
          ],
          tx,
        );

        return customer;
      }

      throw new NotFoundError(`No such customer: ${id}`);
    });
  }

  private static assertPartnerPair(
    payload: Pick<UpdateCustomerPayload, 'partnerPlatform' | 'partnerAccountId'>,
  ): void {
    const isKeyMismatched =
      _.has(payload, 'partnerPlatform') !== _.has(payload, 'partnerAccountId');
    const isValueMismatched =
      _.isNil(payload.partnerPlatform) !== _.isNil(payload.partnerAccountId);

    if (isKeyMismatched || isValueMismatched) {
      throw new BadRequestError('partnerPlatform and partnerAccountId must be set together', {
        param: 'partnerAccountId',
      });
    }
  }

  private static buildPartnerConflictError(
    payload: Pick<UpdateCustomerPayload, 'partnerPlatform' | 'partnerAccountId'>,
    error: unknown,
  ): ConflictError {
    return new ConflictError(
      `Partner account ${payload.partnerAccountId} on ${payload.partnerPlatform} is already mapped to another customer`,
      { param: 'partnerAccountId', cause: error },
    );
  }

  async deleteCustomer(id: string): Promise<DeletedCustomerResponse> {
    await this.getCustomer(id);

    const deletedAt = this.fastify.clock.now().toISOString();

    await this.fastify.database.master.transaction(async (tx) => {
      await this.fastify.customerRepository.archiveCustomer(id, deletedAt, tx);

      await this.fastify.outboxService.recordEvents(
        [
          {
            aggregateType: AggregateTypeEnum.CUSTOMER,
            aggregateId: id,
            eventType: DomainEventTypeEnum.CUSTOMER_DELETED,
            payload: { id },
          },
        ],
        tx,
      );
    });

    return { id, deleted: true };
  }

  async findCustomers(query: FindCustomersQuery): Promise<ListResponse<CustomerResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);

    const rows = await this.fastify.customerRepository.findCustomers(
      { email: query.email, beforeAt, afterAt },
      limit + 1,
    );

    const hasMore = rows.length > limit;

    return {
      url: '/v1/customers',
      hasMore,
      data: _.take(rows, limit),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const customer = await this.fastify.customerRepository.getCustomer(id);

      return { createdAt: customer.createdAt, id: customer.id };
    }

    return undefined;
  }
}
