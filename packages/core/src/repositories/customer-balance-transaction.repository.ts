import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { CustomerBalanceTransaction, NewCustomerBalanceTransaction } from '@database/schemas';
import { customerBalanceTransactions } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, desc, eq, sql } from 'drizzle-orm';

export interface CustomerBalanceTransactionFilters {
  livemode?: boolean;
  customerId?: string;
  invoiceId?: string;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class CustomerBalanceTransactionRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findCustomerBalanceTransaction(id: string): Promise<CustomerBalanceTransaction | null> {
    const [balanceTransaction] = await this._db.master
      .select()
      .from(customerBalanceTransactions)
      .where(eq(customerBalanceTransactions.id, id))
      .limit(1);

    return balanceTransaction ?? null;
  }

  async findCustomerBalanceTransactions(
    filters: CustomerBalanceTransactionFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<CustomerBalanceTransaction[]> {
    const where = and(
      filters.livemode === undefined
        ? undefined
        : eq(customerBalanceTransactions.livemode, filters.livemode),
      filters.customerId
        ? eq(customerBalanceTransactions.customerId, filters.customerId)
        : undefined,
      filters.invoiceId ? eq(customerBalanceTransactions.invoiceId, filters.invoiceId) : undefined,
      filters.beforeAt
        ? sql`(${customerBalanceTransactions.createdAt}, ${customerBalanceTransactions.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${customerBalanceTransactions.createdAt}, ${customerBalanceTransactions.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(customerBalanceTransactions)
      .where(where)
      .orderBy(desc(customerBalanceTransactions.createdAt), desc(customerBalanceTransactions.id))
      .limit(limit);
  }

  async createCustomerBalanceTransaction(
    payload: NewCustomerBalanceTransaction,
    executor?: DatabaseTransaction,
  ): Promise<CustomerBalanceTransaction | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [balanceTransaction] = await db
      .insert(customerBalanceTransactions)
      .values(payload)
      .returning();

    return balanceTransaction ?? null;
  }
}
