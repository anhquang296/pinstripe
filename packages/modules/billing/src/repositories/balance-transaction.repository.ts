import type { BalanceSourceType, BalanceTransactionType } from '@contracts/balance.types';
import type { BalanceTransaction, NewBalanceTransaction } from '@database/schemas';
import { balanceTransactions } from '@database/schemas';
import type { Currency } from '@utils/currency';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import { NotFoundError } from '@vxrerp/platform/errors';
import type { RowCursor } from '@vxrerp/platform/repositories';
import { and, asc, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface BalanceTransactionFilters {
  type?: BalanceTransactionType;
  currency?: Currency;
  sourceType?: BalanceSourceType;
  sourceId?: string;
  payoutId?: string;
  payoutIdIsNull?: boolean;
  availableBeforeAt?: string;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export interface BalanceTotal {
  currency: Currency;
  available: number;
  pending: number;
}

export class BalanceTransactionRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getBalanceTransaction(id: string): Promise<BalanceTransaction> {
    const balanceTransaction = await this.findBalanceTransaction(id);

    if (balanceTransaction) {
      return balanceTransaction;
    }

    throw new NotFoundError(`No such balance transaction: ${id}`);
  }

  async findBalanceTransaction(id: string): Promise<BalanceTransaction | null> {
    const [balanceTransaction] = await this._db.master
      .select()
      .from(balanceTransactions)
      .where(eq(balanceTransactions.id, id))
      .limit(1);

    return balanceTransaction ?? null;
  }

  async findBalanceTransactions(
    filters: BalanceTransactionFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<BalanceTransaction[]> {
    return this._db.master
      .select()
      .from(balanceTransactions)
      .where(BalanceTransactionRepository.buildWhere(filters))
      .orderBy(desc(balanceTransactions.createdAt), desc(balanceTransactions.id))
      .limit(limit);
  }

  async findSweepableBalanceTransactions(
    currency: Currency,
    availableBeforeAt: string,
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<BalanceTransaction[]> {
    return this._db.master
      .select()
      .from(balanceTransactions)
      .where(
        and(
          eq(balanceTransactions.currency, currency),
          isNull(balanceTransactions.payoutId),
          lte(balanceTransactions.availableOn, availableBeforeAt),
        ),
      )
      .orderBy(asc(balanceTransactions.availableOn), asc(balanceTransactions.id))
      .limit(limit);
  }

  async aggregateBalanceTotals(asOf: string): Promise<BalanceTotal[]> {
    return this._db.master
      .select({
        currency: sql<Currency>`${balanceTransactions.currency}`,
        available: sql<number>`coalesce(sum(case when ${balanceTransactions.availableOn} <= ${asOf}::timestamptz then ${balanceTransactions.net} else 0 end), 0)::int`,
        pending: sql<number>`coalesce(sum(case when ${balanceTransactions.availableOn} > ${asOf}::timestamptz then ${balanceTransactions.net} else 0 end), 0)::int`,
      })
      .from(balanceTransactions)
      .where(isNull(balanceTransactions.payoutId))
      .groupBy(balanceTransactions.currency);
  }

  async createBalanceTransaction(
    payload: NewBalanceTransaction,
    executor?: DatabaseTransaction,
  ): Promise<BalanceTransaction | null> {
    const db = executor ?? this._db.master;

    const [balanceTransaction] = await db.insert(balanceTransactions).values(payload).returning();

    return balanceTransaction ?? null;
  }

  async assignBalanceTransactions(
    ids: readonly string[],
    payoutId: string | null,
    executor?: DatabaseTransaction,
  ): Promise<number> {
    if (_.isEmpty(ids)) {
      return 0;
    }

    const db = executor ?? this._db.master;

    const assigned = await db
      .update(balanceTransactions)
      .set({ payoutId })
      .where(inArray(balanceTransactions.id, [...ids]))
      .returning({ id: balanceTransactions.id });

    return assigned.length;
  }

  private static buildWhere(filters: BalanceTransactionFilters) {
    return and(
      filters.type ? eq(balanceTransactions.type, filters.type) : undefined,
      filters.currency ? eq(balanceTransactions.currency, filters.currency) : undefined,
      filters.sourceType ? eq(balanceTransactions.sourceType, filters.sourceType) : undefined,
      filters.sourceId ? eq(balanceTransactions.sourceId, filters.sourceId) : undefined,
      filters.payoutId ? eq(balanceTransactions.payoutId, filters.payoutId) : undefined,
      filters.payoutIdIsNull ? isNull(balanceTransactions.payoutId) : undefined,
      filters.availableBeforeAt
        ? lte(balanceTransactions.availableOn, filters.availableBeforeAt)
        : undefined,
      filters.beforeAt
        ? sql`(${balanceTransactions.createdAt}, ${balanceTransactions.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${balanceTransactions.createdAt}, ${balanceTransactions.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );
  }
}
