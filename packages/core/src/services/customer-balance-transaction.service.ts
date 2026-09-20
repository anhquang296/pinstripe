import type {
  CreateCustomerBalanceTransactionPayload,
  CustomerBalanceTransactionResponse,
  FindCustomerBalanceTransactionsQuery,
} from '@contracts/customers.types';
import { CustomerBalanceTransactionTypeEnum } from '@contracts/customers.types';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@contracts/ledger.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { DatabaseTransaction } from '@database/database.client';
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
  ): Promise<CustomerBalanceTransactionResponse> {
    const now = this.fastify.clock.now().toISOString();

    const id = generateGid(ObjectPrefixEnum.CUSTOMER_BALANCE_TRANSACTION);

    const { description = '', metadata = {} } = payload;

    return this.fastify.database.master.transaction(async (tx) => {
      const customer = await this.fastify.customerRepository.getLockedCustomer(customerId, tx);
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
            customerId,
            invoiceId: null,
            creditNoteId: null,
            type: CustomerBalanceTransactionTypeEnum.ADJUSTMENT,
            currency: payload.currency,
            amount: payload.amount,
            endingBalance,
            description,
            metadata,
            createdAt: now,
          },
          tx,
        );

      if (balanceTransaction) {
        await this.postBalanceAdjustment(balanceTransaction, tx);

        await this.fastify.outboxService.recordEvents(
          [
            {
              aggregateType: AggregateTypeEnum.CUSTOMER_BALANCE_TRANSACTION,
              aggregateId: balanceTransaction.id,
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
  }

  private async postBalanceAdjustment(
    balanceTransaction: CustomerBalanceTransaction,
    tx: DatabaseTransaction,
  ): Promise<void> {
    const { amount, customerId } = balanceTransaction;

    if (amount === 0) {
      return;
    }

    const isCreditGranted = amount < 0;

    const balanceDirection = isCreditGranted
      ? PostingDirectionEnum.CREDIT
      : PostingDirectionEnum.DEBIT;

    const revenueDirection = isCreditGranted
      ? PostingDirectionEnum.DEBIT
      : PostingDirectionEnum.CREDIT;

    await this.fastify.ledgerService.postTransaction(
      {
        description: `Customer balance adjustment ${balanceTransaction.id}`,
        currency: balanceTransaction.currency,
        externalId: `customer_balance_transaction:${balanceTransaction.id}`,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.CUSTOMER_CREDIT_BALANCE,
            customerId,
            direction: balanceDirection,
            amount: Math.abs(amount),
          },
          {
            accountCode: LedgerAccountCodeEnum.REVENUE,
            direction: revenueDirection,
            amount: Math.abs(amount),
          },
        ],
      },
      tx,
    );
  }

  async getCustomerBalanceTransaction(id: string): Promise<CustomerBalanceTransactionResponse> {
    return this.fastify.customerBalanceTransactionRepository.getCustomerBalanceTransaction(id);
  }

  async findCustomerBalanceTransactions(
    customerId: string,
    query: FindCustomerBalanceTransactionsQuery,
  ): Promise<ListResponse<CustomerBalanceTransactionResponse>> {
    await this.fastify.customerService.getCustomer(customerId);

    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);

    const rows =
      await this.fastify.customerBalanceTransactionRepository.findCustomerBalanceTransactions(
        { customerId, beforeAt, afterAt },
        limit + 1,
      );

    return {
      url: `/v1/customers/${customerId}/balance_transactions`,
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const balanceTransaction =
        await this.fastify.customerBalanceTransactionRepository.getCustomerBalanceTransaction(id);

      return { createdAt: balanceTransaction.createdAt, id: balanceTransaction.id };
    }

    return undefined;
  }
}
