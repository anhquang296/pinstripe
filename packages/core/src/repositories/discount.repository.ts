import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { DiscountLevel } from '@contracts/discounts.types';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { Discount, NewDiscount } from '@database/schemas';
import { discounts } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, asc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';

export interface DiscountFilters {
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  couponId?: string;
  level?: DiscountLevel;
  activeAt?: string;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class DiscountRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findDiscount(id: string): Promise<Discount | null> {
    const [discount] = await this._db.master
      .select()
      .from(discounts)
      .where(and(eq(discounts.id, id), isNull(discounts.deletedAt)))
      .limit(1);

    return discount ?? null;
  }

  async findDiscounts(
    filters: DiscountFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<Discount[]> {
    const where = and(
      isNull(discounts.deletedAt),
      filters.customerId ? eq(discounts.customerId, filters.customerId) : undefined,
      filters.subscriptionId ? eq(discounts.subscriptionId, filters.subscriptionId) : undefined,
      filters.invoiceId ? eq(discounts.invoiceId, filters.invoiceId) : undefined,
      filters.couponId ? eq(discounts.couponId, filters.couponId) : undefined,
      filters.level ? eq(discounts.level, filters.level) : undefined,
      filters.activeAt
        ? and(
            lte(discounts.startAt, filters.activeAt),
            or(isNull(discounts.endAt), gt(discounts.endAt, filters.activeAt)),
          )
        : undefined,
      filters.beforeAt
        ? sql`(${discounts.createdAt}, ${discounts.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${discounts.createdAt}, ${discounts.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(discounts)
      .where(where)
      .orderBy(asc(discounts.createdAt), asc(discounts.id))
      .limit(limit);
  }

  async createDiscount(
    payload: NewDiscount,
    executor?: DatabaseTransaction,
  ): Promise<Discount | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [discount] = await db.insert(discounts).values(payload).returning();

    return discount ?? null;
  }

  async updateDiscount(
    id: string,
    payload: Partial<NewDiscount>,
    executor?: DatabaseTransaction,
  ): Promise<Discount | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [discount] = await db
      .update(discounts)
      .set(payload)
      .where(and(eq(discounts.id, id), isNull(discounts.deletedAt)))
      .returning();

    return discount ?? null;
  }

  async archiveDiscount(
    id: string,
    deletedAt: string,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(discounts)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(discounts.id, id), isNull(discounts.deletedAt)));
  }
}
