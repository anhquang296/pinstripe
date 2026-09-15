import type { FastifyInstance } from 'fastify';
import type {
  CreateCustomerPayload,
  Customer,
  GetCustomersQuery,
  UpdateCustomerPayload,
} from '@contracts/customers.types';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { CustomerEntity } from '@database/schemas';
import { ConflictError, NotFoundError } from '@errors/app.error';
import { isUniqueViolation } from '@errors/database.error';
import type { RowCursor } from '@repositories/cursor';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';

export interface DeletedCustomerResponse {
  object: 'customer';
  id: string;
  deleted: true;
}

export class CustomerService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
    const now = this.fastify.clock.now();
    const id = generateId(ObjectPrefixEnum.CUSTOMER);

    const created = await this.insertCustomer(id, payload, now);

    return CustomerService.buildCustomer(created);
  }

  private async insertCustomer(
    id: string,
    payload: CreateCustomerPayload,
    now: Date,
  ): Promise<CustomerEntity> {
    try {
      return await this.fastify.database.master.transaction(async (tx) => {
        const customer = await this.fastify.customerRepository.createCustomer(
          {
            id,
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

        if (!customer) {
          throw new NotFoundError(`Customer ${id} could not be created`);
        }

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

  async getCustomer(id: string): Promise<Customer> {
    const customer = await this.fastify.customerRepository.findCustomer(id);

    if (customer) {
      return CustomerService.buildCustomer(customer);
    }

    throw new NotFoundError(`No such customer: ${id}`);
  }

  async updateCustomer(id: string, payload: UpdateCustomerPayload): Promise<Customer> {
    await this.getCustomer(id);

    const updated = await this.fastify.database.master.transaction(async (tx) => {
      const customer = await this.fastify.customerRepository.updateCustomer(
        id,
        { ...payload, updatedAt: this.fastify.clock.now() },
        tx,
      );

      if (!customer) {
        throw new NotFoundError(`No such customer: ${id}`);
      }

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
    });

    return CustomerService.buildCustomer(updated);
  }

  async deleteCustomer(id: string): Promise<DeletedCustomerResponse> {
    await this.getCustomer(id);

    await this.fastify.database.master.transaction(async (tx) => {
      await this.fastify.customerRepository.softDeleteCustomer(id, this.fastify.clock.now(), tx);
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

    return { object: 'customer', id, deleted: true };
  }

  async findCustomers(query: GetCustomersQuery): Promise<ListResponse<Customer>> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const beforeCursor = await this.resolveCursor(query.startingAfter);
    const afterCursor = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.customerRepository.findCustomers(
      { emailEq: query.email, beforeCursor, afterCursor },
      limit + 1,
    );
    const hasMore = rows.length > limit;

    return {
      object: 'list',
      url: '/v1/customers',
      hasMore,
      data: rows.slice(0, limit).map(CustomerService.buildCustomer),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (!id) {
      return undefined;
    }

    const customer = await this.fastify.customerRepository.findCustomer(id);

    if (!customer) {
      throw new NotFoundError(`No such customer: ${id}`);
    }

    return { createdAt: customer.createdAt, id: customer.id };
  }

  private static buildCustomer(entity: CustomerEntity): Customer {
    return {
      object: 'customer',
      id: entity.id,
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
