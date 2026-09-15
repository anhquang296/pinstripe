import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type {
  GetLedgerAccountsQuery,
  GetLedgerTransactionsQuery,
  LedgerAccountCode,
  LedgerAccountResponse,
  LedgerPostingResponse,
  LedgerTransactionResponse,
  PostLedgerTransactionPayload,
  ReverseLedgerTransactionPayload,
} from '@contracts/ledger.types';
import {
  LEDGER_ACCOUNT_DEFINITIONS,
  LedgerAccountCodeEnum,
  PostingDirectionEnum,
} from '@contracts/ledger.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { LedgerPosting, LedgerTransaction, NewLedgerPosting } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import { isUniqueViolation } from '@errors/database.error';
import type { LedgerAccountWithBalance } from '@repositories/ledger-account.repository';
import type { Currency } from '@utils/currency';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const SINGLE_ROW_LIMIT = 1;

export class LedgerService {
  constructor(private readonly fastify: FastifyInstance) {}

  async ensureAccount(
    code: LedgerAccountCode,
    currency: Currency,
    customerId?: string,
  ): Promise<LedgerAccountWithBalance> {
    const definition = LEDGER_ACCOUNT_DEFINITIONS[code];

    if (definition.isPerCustomer && !customerId) {
      throw new BadRequestError(`Ledger account ${code} is per customer and needs a customerId`);
    }

    if (!definition.isPerCustomer && customerId) {
      throw new BadRequestError(`Ledger account ${code} is shared and must not carry a customerId`);
    }

    const existingAccount = await this.findAccount(code, currency, customerId);

    if (existingAccount) {
      return existingAccount;
    }

    try {
      await this.fastify.ledgerAccountRepository.createLedgerAccount({
        id: generateId(ObjectPrefixEnum.LEDGER_ACCOUNT),
        code,
        type: definition.type,
        normalBalance: definition.normalBalance,
        currency,
        customerId: customerId ?? null,
        createdAt: this.fastify.clock.now(),
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }

    const account = await this.findAccount(code, currency, customerId);

    if (account) {
      return account;
    }

    throw new NotFoundError(`Ledger account ${code} could not be provisioned`);
  }

  async postTransaction(
    payload: PostLedgerTransactionPayload,
    executor?: DatabaseTransaction,
  ): Promise<LedgerTransactionResponse> {
    LedgerService.assertBalanced(payload);

    const now = this.fastify.clock.now();
    const transactionId = generateId(ObjectPrefixEnum.LEDGER_TRANSACTION);
    const postings = await this.buildPostings(transactionId, payload, now);

    const postedTransaction = await this.writeTransaction(
      {
        id: transactionId,
        description: payload.description,
        currency: payload.currency,
        externalId: payload.externalId ?? null,
        effectiveAt: payload.effectiveAt ? new Date(payload.effectiveAt) : now,
        reversesTransactionId: null,
        reversedByTransactionId: null,
        metadata: payload.metadata ?? {},
        createdAt: now,
      },
      postings,
      DomainEventTypeEnum.LEDGER_TRANSACTION_POSTED,
      executor,
    );
    const accountCodesById = await this.resolveAccountCodes(postings);

    return LedgerService.buildTransaction(postedTransaction, postings, accountCodesById);
  }

  async getTransaction(id: string): Promise<LedgerTransactionResponse> {
    const transaction = await this.fastify.ledgerTransactionRepository.findLedgerTransaction(id);

    if (!transaction) {
      throw new NotFoundError(`No such ledger transaction: ${id}`);
    }

    const postings = await this.fastify.ledgerTransactionRepository.findLedgerPostings([id]);
    const accountCodesById = await this.resolveAccountCodes(postings);

    return LedgerService.buildTransaction(transaction, postings, accountCodesById);
  }

  async findTransactions(
    query: GetLedgerTransactionsQuery,
  ): Promise<ListResponse<LedgerTransactionResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const accountId = await this.resolveAccountFilter(query);
    const transactionRows = await this.fastify.ledgerTransactionRepository.findLedgerTransactions(
      {
        accountId,
        beforeAt: await this.resolveCursor(query.startingAfter),
        afterAt: await this.resolveCursor(query.endingBefore),
      },
      limit + 1,
    );
    const hasMore = transactionRows.length > limit;
    const page = _.take(transactionRows, limit);
    const postings = await this.fastify.ledgerTransactionRepository.findLedgerPostings(
      _.map(page, 'id'),
    );
    const accountCodesById = await this.resolveAccountCodes(postings);
    const transactions = _.map(page, (transaction) => {
      return LedgerService.buildTransaction(
        transaction,
        _.filter(postings, { transactionId: transaction.id }),
        accountCodesById,
      );
    });

    return {
      object: 'list',
      url: '/api/v1/admin/ledger/transactions',
      hasMore,
      data: transactions,
    };
  }

  async getAccount(id: string): Promise<LedgerAccountResponse> {
    const account = await this.fastify.ledgerAccountRepository.findLedgerAccount(id);

    if (account) {
      return LedgerService.buildAccount(account);
    }

    throw new NotFoundError(`No such ledger account: ${id}`);
  }

  async findAccounts(query: GetLedgerAccountsQuery): Promise<ListResponse<LedgerAccountResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const accountRows = await this.fastify.ledgerAccountRepository.findLedgerAccounts(
      { code: query.code, customerId: query.customerId },
      limit + 1,
    );
    const hasMore = accountRows.length > limit;

    return {
      object: 'list',
      url: '/api/v1/admin/ledger/accounts',
      hasMore,
      data: _(accountRows).take(limit).map(LedgerService.buildAccount).value(),
    };
  }

  async reverseTransaction(
    id: string,
    payload: ReverseLedgerTransactionPayload,
  ): Promise<LedgerTransactionResponse> {
    const original = await this.fastify.ledgerTransactionRepository.findLedgerTransaction(id);

    if (!original) {
      throw new NotFoundError(`No such ledger transaction: ${id}`);
    }

    if (original.reversedByTransactionId) {
      throw new ConflictError(
        `Ledger transaction ${id} is already reversed by ${original.reversedByTransactionId}`,
      );
    }

    const originalPostings = await this.fastify.ledgerTransactionRepository.findLedgerPostings([
      id,
    ]);
    const now = this.fastify.clock.now();
    const reversalId = generateId(ObjectPrefixEnum.LEDGER_TRANSACTION);
    const postings: NewLedgerPosting[] = _.map(originalPostings, (posting) => {
      return {
        id: generateId(ObjectPrefixEnum.LEDGER_POSTING),
        transactionId: reversalId,
        accountId: posting.accountId,
        direction:
          posting.direction === PostingDirectionEnum.DEBIT
            ? PostingDirectionEnum.CREDIT
            : PostingDirectionEnum.DEBIT,
        amount: posting.amount,
        currency: posting.currency,
        createdAt: now,
      };
    });

    const reversalTransaction = await this.writeTransaction(
      {
        id: reversalId,
        description: `Reversal of ${id}: ${payload.reason}`,
        currency: original.currency,
        externalId: null,
        effectiveAt: now,
        reversesTransactionId: id,
        reversedByTransactionId: null,
        metadata: original.metadata,
        createdAt: now,
      },
      postings,
      DomainEventTypeEnum.LEDGER_TRANSACTION_REVERSED,
      undefined,
      id,
    );

    const accountCodesById = await this.resolveAccountCodes(postings);

    return LedgerService.buildTransaction(reversalTransaction, postings, accountCodesById);
  }

  async findImbalancedTransactions(limit: number): Promise<string[]> {
    const imbalancedRows =
      await this.fastify.ledgerTransactionRepository.aggregateImbalancedTransactions(limit);

    return _.map(imbalancedRows, 'transactionId');
  }

  private async writeTransaction(
    transaction: LedgerTransaction,
    postings: readonly NewLedgerPosting[],
    eventType: DomainEventTypeEnum,
    executor?: DatabaseTransaction,
    reversedTransactionId?: string,
  ): Promise<LedgerTransaction> {
    const write = async (tx: DatabaseTransaction): Promise<LedgerTransaction> => {
      const createdTransaction =
        await this.fastify.ledgerTransactionRepository.createLedgerTransaction(
          transaction,
          postings,
          tx,
        );

      if (!createdTransaction) {
        throw new NotFoundError(`Ledger transaction ${transaction.id} could not be posted`);
      }

      if (reversedTransactionId) {
        await this.fastify.ledgerTransactionRepository.linkLedgerReversal(
          reversedTransactionId,
          createdTransaction.id,
          tx,
        );
      }

      await this.fastify.outboxService.recordEvents(
        [
          {
            aggregateType: AggregateTypeEnum.LEDGER_TRANSACTION,
            aggregateId: createdTransaction.id,
            eventType,
            payload: { id: createdTransaction.id, currency: createdTransaction.currency },
          },
        ],
        tx,
      );

      return createdTransaction;
    };

    try {
      if (executor) {
        return await write(executor);
      }

      return await this.fastify.database.master.transaction(write);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          `A ledger transaction with externalId ${transaction.externalId} already exists`,
          { param: 'externalId', cause: error },
        );
      }

      throw error;
    }
  }

  private async buildPostings(
    transactionId: string,
    payload: PostLedgerTransactionPayload,
    now: Date,
  ): Promise<NewLedgerPosting[]> {
    const postings: NewLedgerPosting[] = [];

    for (const entry of payload.entries) {
      const account = await this.resolveEntryAccount(entry, payload.currency);

      if (account.currency !== payload.currency) {
        throw new BadRequestError(
          `Ledger account ${account.id} holds ${account.currency}, not ${payload.currency}`,
        );
      }

      postings.push({
        id: generateId(ObjectPrefixEnum.LEDGER_POSTING),
        transactionId,
        accountId: account.id,
        direction: entry.direction,
        amount: entry.amount,
        currency: payload.currency,
        createdAt: now,
      });
    }

    return postings;
  }

  private async resolveEntryAccount(
    entry: PostLedgerTransactionPayload['entries'][number],
    currency: Currency,
  ): Promise<LedgerAccountWithBalance> {
    if (entry.accountId) {
      const account = await this.fastify.ledgerAccountRepository.findLedgerAccount(entry.accountId);

      if (account) {
        return account;
      }

      throw new NotFoundError(`No such ledger account: ${entry.accountId}`);
    }

    if (!entry.accountCode) {
      throw new BadRequestError('Each ledger entry needs either an accountId or an accountCode');
    }

    return this.ensureAccount(entry.accountCode, currency, entry.customerId);
  }

  private async resolveAccountFilter(
    query: GetLedgerTransactionsQuery,
  ): Promise<string | undefined> {
    if (query.accountId) {
      return query.accountId;
    }

    if (!query.customerId) {
      return undefined;
    }

    const [account] = await this.fastify.ledgerAccountRepository.findLedgerAccounts(
      { customerId: query.customerId, code: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE },
      SINGLE_ROW_LIMIT,
    );

    return account?.id;
  }

  private async resolveCursor(id: string | undefined) {
    if (!id) {
      return undefined;
    }

    const transaction = await this.fastify.ledgerTransactionRepository.findLedgerTransaction(id);

    if (!transaction) {
      throw new NotFoundError(`No such ledger transaction: ${id}`);
    }

    return { createdAt: transaction.createdAt, id: transaction.id };
  }

  private async findAccount(
    code: LedgerAccountCode,
    currency: Currency,
    customerId: string | undefined,
  ): Promise<LedgerAccountWithBalance | null> {
    const [account] = await this.fastify.ledgerAccountRepository.findLedgerAccounts(
      {
        code,
        currency,
        customerId,
        customerIdIsNull: customerId ? undefined : true,
      },
      SINGLE_ROW_LIMIT,
    );

    return account ?? null;
  }

  private async resolveAccountCodes(
    postings: readonly (LedgerPosting | NewLedgerPosting)[],
  ): Promise<Record<string, LedgerAccountCode>> {
    const accountIds = _.uniq(_.map(postings, 'accountId'));
    const accounts = await this.fastify.ledgerAccountRepository.findLedgerAccounts(
      { ids: accountIds },
      accountIds.length || SINGLE_ROW_LIMIT,
    );

    return _(accounts).keyBy('id').mapValues('code').value();
  }

  private static buildTransaction(
    entity: LedgerTransaction,
    postings: readonly (LedgerPosting | NewLedgerPosting)[],
    accountCodesById: Record<string, LedgerAccountCode>,
  ): LedgerTransactionResponse {
    return {
      object: 'ledger_transaction',
      id: entity.id,
      description: entity.description,
      currency: entity.currency,
      externalId: entity.externalId,
      effectiveAt: entity.effectiveAt.toISOString(),
      reversesTransactionId: entity.reversesTransactionId,
      reversedByTransactionId: entity.reversedByTransactionId,
      metadata: entity.metadata,
      postings: _.map(postings, (posting) => {
        return LedgerService.buildPosting(posting, accountCodesById[posting.accountId]);
      }),
      createdAt: entity.createdAt.toISOString(),
    };
  }

  private static buildPosting(
    posting: LedgerPosting | NewLedgerPosting,
    accountCode: LedgerAccountCode | undefined,
  ): LedgerPostingResponse {
    if (!accountCode) {
      throw new NotFoundError(`No such ledger account: ${posting.accountId}`);
    }

    return {
      object: 'ledger_posting',
      id: posting.id,
      transactionId: posting.transactionId,
      accountId: posting.accountId,
      accountCode,
      direction: posting.direction,
      amount: posting.amount,
      currency: posting.currency,
      createdAt: (posting.createdAt ?? new Date()).toISOString(),
    };
  }

  private static buildAccount(account: LedgerAccountWithBalance): LedgerAccountResponse {
    return {
      object: 'ledger_account',
      id: account.id,
      code: account.code,
      type: account.type,
      normalBalance: account.normalBalance,
      currency: account.currency,
      customerId: account.customerId,
      debits: account.debits,
      credits: account.credits,
      balance: account.balance,
      createdAt: account.createdAt.toISOString(),
    };
  }

  private static assertBalanced(payload: PostLedgerTransactionPayload): void {
    const debits = _(payload.entries)
      .filter({ direction: PostingDirectionEnum.DEBIT })
      .sumBy('amount');
    const credits = _(payload.entries)
      .filter({ direction: PostingDirectionEnum.CREDIT })
      .sumBy('amount');

    if (debits !== credits) {
      throw new BadRequestError(
        `Ledger transaction must balance: debits ${debits} do not equal credits ${credits}`,
        { param: 'entries' },
      );
    }

    if (debits === 0) {
      throw new BadRequestError('Ledger transaction must move a non zero amount', {
        param: 'entries',
      });
    }
  }
}
