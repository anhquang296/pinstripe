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
import type { Customer } from '@database/schemas';
import { ConflictError, NotFoundError } from '@errors/app.error';
import { isUniqueViolation } from '@errors/database.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class CustomerService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createCustomer(
    payload: CreateCustomerPayload,
    livemode: boolean,
  ): Promise<CustomerResponse> {
    const now = this.fastify.clock.now();
    const id = generateGid(ObjectPrefixEnum.CUSTOMER);

    const createdCustomer = await this.writeCustomer(id, payload, now, livemode);

    return CustomerService.buildCustomer(createdCustomer);
  }

  private async writeCustomer(
    id: string,
    payload: CreateCustomerPayload,
    now: Date,
    livemode: boolean,
  ): Promise<Customer> {
    try {
      return await this.fastify.database.master.transaction(async (tx) => {
        const customer = await this.fastify.customerRepository.createCustomer(
          {
            id,
            livemode,
            email: payload.email ?? null,
            name: payload.name ?? '',
            description: payload.description ?? '',
            phone: payload.phone ?? '',
            taxId: payload.taxId ?? null,
            address: payload.address ?? null,
            currency: payload.currency,
            testClockId: payload.testClockId ?? null,
            metadata: payload.metadata ?? {},
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
                livemode: customer.livemode,
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
    const customer = await this.fastify.customerRepository.findCustomer(id);

    if (customer) {
      return CustomerService.buildCustomer(customer);
    }

    throw new NotFoundError(`No such customer: ${id}`);
  }

  async updateCustomer(id: string, payload: UpdateCustomerPayload): Promise<CustomerResponse> {
    await this.getCustomer(id);

    const updatedCustomer = await this.fastify.database.master.transaction(async (tx) => {
      const customer = await this.fastify.customerRepository.updateCustomer(
        id,
        { ...payload, updatedAt: this.fastify.clock.now() },
        tx,
      );

      if (customer) {
        await this.fastify.outboxService.recordEvents(
          [
            {
              aggregateType: AggregateTypeEnum.CUSTOMER,
              aggregateId: customer.id,
              livemode: customer.livemode,
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

    return CustomerService.buildCustomer(updatedCustomer);
  }

  async deleteCustomer(id: string): Promise<DeletedCustomerResponse> {
    const customer = await this.getCustomer(id);

    await this.fastify.database.master.transaction(async (tx) => {
      await this.fastify.customerRepository.archiveCustomer(id, this.fastify.clock.now(), tx);
      await this.fastify.outboxService.recordEvents(
        [
          {
            aggregateType: AggregateTypeEnum.CUSTOMER,
            aggregateId: id,
            livemode: customer.livemode,
            eventType: DomainEventTypeEnum.CUSTOMER_DELETED,
            payload: { id },
          },
        ],
        tx,
      );
    });

    return { object: 'customer', id, deleted: true };
  }

  async findCustomers(
    query: FindCustomersQuery,
    livemode: boolean,
  ): Promise<ListResponse<CustomerResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.customerRepository.findCustomers(
      { livemode, email: query.email, beforeAt, afterAt },
      limit + 1,
    );
    const hasMore = rows.length > limit;

    return {
      object: 'list',
      url: '/v1/customers',
      hasMore,
      data: _(rows).take(limit).map(CustomerService.buildCustomer).value(),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const customer = await this.fastify.customerRepository.findCustomer(id);

      if (customer) {
        return { createdAt: customer.createdAt, id: customer.id };
      }

      throw new NotFoundError(`No such customer: ${id}`);
    }

    return undefined;
  }

  private static buildCustomer(entity: Customer): CustomerResponse {
    return {
      object: 'customer',
      id: entity.id,
      livemode: entity.livemode,
      email: entity.email,
      name: entity.name,
      description: entity.description,
      phone: entity.phone,
      taxId: entity.taxId,
      address: entity.address,
      currency: entity.currency,
      testClockId: entity.testClockId,
      balance: entity.balance,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
