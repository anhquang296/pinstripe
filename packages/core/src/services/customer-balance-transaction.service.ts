import type {
  CreateCustomerBalanceTransactionPayload,
  CustomerBalanceTransactionResponse,
  FindCustomerBalanceTransactionsQuery,
} from '@contracts/customers.types';
import { CustomerBalanceTransactionTypeEnum } from '@contracts/customers.types';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { CustomerBalanceTransaction } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class CustomerBalanceTransactionService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createCustomerBalanceTransaction(
    customerId: string,
    payload: CreateCustomerBalanceTransactionPayload,
    livemode: boolean,
  ): Promise<CustomerBalanceTransactionResponse> {
    const now = this.fastify.clock.now();
    const id = generateGid(ObjectPrefixEnum.CUSTOMER_BALANCE_TRANSACTION);

    const createdBalanceTransaction = await this.fastify.database.master.transaction(async (tx) => {
      const customer = await this.fastify.customerRepository.lockCustomer(customerId, tx);

      if (!customer || customer.livemode !== livemode) {
        throw new NotFoundError(`No such customer: ${customerId}`);
      }

      const endingBalance = customer.balance + payload.amount;

      await this.fastify.customerRepository.updateCustomer(
        customerId,
        { balance: endingBalance, updatedAt: now },
        tx,
      );

      const balanceTransaction =
        await this.fastify.customerBalanceTransactionRepository.createCustomerBalanceTransaction(
          {
            id,
            livemode,
            customerId,
            invoiceId: null,
            creditNoteId: null,
            type: CustomerBalanceTransactionTypeEnum.ADJUSTMENT,
            currency: payload.currency,
            amount: payload.amount,
            endingBalance,
            description: payload.description ?? '',
            metadata: payload.metadata ?? {},
            createdAt: now,
          },
          tx,
        );

      if (balanceTransaction) {
        await this.fastify.outboxService.recordEvents(
          [
            {
              aggregateType: AggregateTypeEnum.CUSTOMER_BALANCE_TRANSACTION,
              aggregateId: balanceTransaction.id,
              livemode,
              eventType: DomainEventTypeEnum.CUSTOMER_BALANCE_TRANSACTION_CREATED,
              payload: { id: balanceTransaction.id, customerId },
            },
          ],
          tx,
        );

        return balanceTransaction;
      }

      throw new NotFoundError(`Customer balance transaction ${id} could not be created`);
    });

    return CustomerBalanceTransactionService.buildCustomerBalanceTransaction(
      createdBalanceTransaction,
    );
  }

  async getCustomerBalanceTransaction(
    id: string,
    livemode: boolean,
  ): Promise<CustomerBalanceTransactionResponse> {
    const balanceTransaction =
      await this.fastify.customerBalanceTransactionRepository.findCustomerBalanceTransaction(id);

    if (balanceTransaction && balanceTransaction.livemode === livemode) {
      return CustomerBalanceTransactionService.buildCustomerBalanceTransaction(balanceTransaction);
    }

    throw new NotFoundError(`No such customer balance transaction: ${id}`);
  }

  async findCustomerBalanceTransactions(
    customerId: string,
    query: FindCustomerBalanceTransactionsQuery,
    livemode: boolean,
  ): Promise<ListResponse<CustomerBalanceTransactionResponse>> {
    await this.fastify.customerService.getCustomer(customerId, livemode);

    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);

    const rows =
      await this.fastify.customerBalanceTransactionRepository.findCustomerBalanceTransactions(
        { livemode, customerId, beforeAt, afterAt },
        limit + 1,
      );

    return {
      object: 'list',
      url: `/v1/customers/${customerId}/balance_transactions`,
      hasMore: rows.length > limit,
      data: _(rows)
        .take(limit)
        .map(CustomerBalanceTransactionService.buildCustomerBalanceTransaction)
        .value(),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const balanceTransaction =
        await this.fastify.customerBalanceTransactionRepository.findCustomerBalanceTransaction(id);

      if (balanceTransaction) {
        return { createdAt: balanceTransaction.createdAt, id: balanceTransaction.id };
      }

      throw new NotFoundError(`No such customer balance transaction: ${id}`);
    }

    return undefined;
  }

  static buildCustomerBalanceTransaction(
    entity: CustomerBalanceTransaction,
  ): CustomerBalanceTransactionResponse {
    return {
      object: 'customer_balance_transaction',
      id: entity.id,
      livemode: entity.livemode,
      customerId: entity.customerId,
      invoiceId: entity.invoiceId,
      creditNoteId: entity.creditNoteId,
      type: entity.type,
      currency: entity.currency,
      amount: entity.amount,
      endingBalance: entity.endingBalance,
      description: entity.description,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
