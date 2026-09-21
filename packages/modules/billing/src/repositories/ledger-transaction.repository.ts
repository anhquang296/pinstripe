import { PostingDirectionEnum } from '@contracts/ledger.types';
import type {
  LedgerPosting,
  LedgerTransaction,
  NewLedgerPosting,
  NewLedgerTransaction,
} from '@database/schemas';
import { ledgerPostings, ledgerTransactions } from '@database/schemas';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { Database, DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import { NotFoundError } from '@vxrerp/platform/errors';
import type { RowCursor } from '@vxrerp/platform/repositories';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface LedgerTransactionFilters {
  accountId?: string;
  externalId?: string;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export interface ImbalancedTransactionTotals {
  transactionId: string;
  signedTotal: number;
}

export class LedgerTransactionRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getLedgerTransaction(id: string): Promise<LedgerTransaction> {
    const ledgerTransaction = await this.findLedgerTransaction(id);

    if (ledgerTransaction) {
      return ledgerTransaction;
    }

    throw new NotFoundError(`No such ledger transaction: ${id}`);
  }

  async findLedgerTransaction(id: string): Promise<LedgerTransaction | null> {
    const [transaction] = await this._db.master
      .select()
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.id, id))
      .limit(1);

    return transaction ?? null;
  }

  async findLedgerTransactions(
    filters: LedgerTransactionFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<LedgerTransaction[]> {
    const where = and(
      filters.accountId
        ? sql`exists (select 1 from ${ledgerPostings} where ${ledgerPostings.transactionId} = ${ledgerTransactions.id} and ${ledgerPostings.accountId} = ${filters.accountId})`
        : undefined,
      filters.externalId ? eq(ledgerTransactions.externalId, filters.externalId) : undefined,
      filters.beforeAt
        ? sql`(${ledgerTransactions.createdAt}, ${ledgerTransactions.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${ledgerTransactions.createdAt}, ${ledgerTransactions.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(ledgerTransactions)
      .where(where)
      .orderBy(desc(ledgerTransactions.createdAt), desc(ledgerTransactions.id))
      .limit(limit);
  }

  async findLedgerPostings(transactionIds: readonly string[]): Promise<LedgerPosting[]> {
    if (_.isEmpty(transactionIds)) {
      return [];
    }

    return this._db.master
      .select()
      .from(ledgerPostings)
      .where(inArray(ledgerPostings.transactionId, [...transactionIds]));
  }

  async aggregateImbalancedTransactions(limit: number): Promise<ImbalancedTransactionTotals[]> {
    const imbalancedRows = await this._db.master
      .select({
        transactionId: ledgerPostings.transactionId,
        signedTotal: sql<number>`sum(case when ${ledgerPostings.direction} = ${PostingDirectionEnum.DEBIT} then ${ledgerPostings.amount} else -${ledgerPostings.amount} end)`,
      })
      .from(ledgerPostings)
      .groupBy(ledgerPostings.transactionId)
      .having(
        sql`sum(case when ${ledgerPostings.direction} = ${PostingDirectionEnum.DEBIT} then ${ledgerPostings.amount} else -${ledgerPostings.amount} end) <> 0`,
      )
      .limit(limit);

    return imbalancedRows;
  }

  async createLedgerTransaction(
    transaction: NewLedgerTransaction,
    postings: readonly NewLedgerPosting[],
    executor?: DatabaseTransaction,
  ): Promise<LedgerTransaction | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    const [created] = await db.insert(ledgerTransactions).values(transaction).returning();

    await db.insert(ledgerPostings).values([...postings]);

    return created ?? null;
  }

  async linkLedgerReversal(
    transactionId: string,
    reversedByTransactionId: string,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(ledgerTransactions)
      .set({ reversedByTransactionId })
      .where(eq(ledgerTransactions.id, transactionId));
  }
}
