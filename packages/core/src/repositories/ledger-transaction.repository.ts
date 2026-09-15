import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type {
  LedgerPostingEntity,
  LedgerTransactionEntity,
  NewLedgerPostingEntity,
  NewLedgerTransactionEntity,
} from '@database/schemas';
import { ledgerPostings, ledgerTransactions } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';

export interface FindLedgerTransactionsFilters {
  accountIdEq?: string;
  beforeCursor?: RowCursor;
  afterCursor?: RowCursor;
}

export class LedgerTransactionRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findLedgerTransaction(id: string): Promise<LedgerTransactionEntity | null> {
    const [transaction] = await this._db.master
      .select()
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.id, id))
      .limit(1);

    return transaction ?? null;
  }

  async findLedgerTransactions(
    filters: FindLedgerTransactionsFilters,
    limit: number,
  ): Promise<LedgerTransactionEntity[]> {
    const where = and(
      filters.accountIdEq
        ? sql`exists (select 1 from ${ledgerPostings} where ${ledgerPostings.transactionId} = ${ledgerTransactions.id} and ${ledgerPostings.accountId} = ${filters.accountIdEq})`
        : undefined,
      filters.beforeCursor
        ? sql`(${ledgerTransactions.createdAt}, ${ledgerTransactions.id}) < (${filters.beforeCursor.createdAt.toISOString()}::timestamptz, ${filters.beforeCursor.id})`
        : undefined,
      filters.afterCursor
        ? sql`(${ledgerTransactions.createdAt}, ${ledgerTransactions.id}) > (${filters.afterCursor.createdAt.toISOString()}::timestamptz, ${filters.afterCursor.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(ledgerTransactions)
      .where(where)
      .orderBy(desc(ledgerTransactions.createdAt), desc(ledgerTransactions.id))
      .limit(limit);
  }

  async findLedgerPostings(transactionIds: readonly string[]): Promise<LedgerPostingEntity[]> {
    if (transactionIds.length === 0) {
      return [];
    }

    return this._db.master
      .select()
      .from(ledgerPostings)
      .where(inArray(ledgerPostings.transactionId, [...transactionIds]));
  }

  async createLedgerTransaction(
    transaction: NewLedgerTransactionEntity,
    postings: readonly NewLedgerPostingEntity[],
    executor?: DatabaseTransaction,
  ): Promise<LedgerTransactionEntity | null> {
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
