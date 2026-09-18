import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { Coupon, NewCoupon } from '@database/schemas';
import { coupons } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

export interface CouponFilters {
  livemode?: boolean;
  ids?: readonly string[];
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class CouponRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findCoupon(id: string): Promise<Coupon | null> {
    const [coupon] = await this._db.master
      .select()
      .from(coupons)
      .where(and(eq(coupons.id, id), isNull(coupons.deletedAt)))
      .limit(1);

    return coupon ?? null;
  }

  async findCoupons(filters: CouponFilters = {}, limit = DEFAULT_QUERY_LIMIT): Promise<Coupon[]> {
    const where = and(
      isNull(coupons.deletedAt),
      filters.livemode === undefined ? undefined : eq(coupons.livemode, filters.livemode),
      filters.ids ? inArray(coupons.id, [...filters.ids]) : undefined,
      filters.beforeAt
        ? sql`(${coupons.createdAt}, ${coupons.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${coupons.createdAt}, ${coupons.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(coupons)
      .where(where)
      .orderBy(asc(coupons.createdAt), asc(coupons.id))
      .limit(limit);
  }

  async createCoupon(payload: NewCoupon, executor?: DatabaseTransaction): Promise<Coupon | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [coupon] = await db.insert(coupons).values(payload).returning();

    return coupon ?? null;
  }

  async updateCoupon(
    id: string,
    payload: Partial<NewCoupon>,
    executor?: DatabaseTransaction,
  ): Promise<Coupon | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [coupon] = await db
      .update(coupons)
      .set(payload)
      .where(and(eq(coupons.id, id), isNull(coupons.deletedAt)))
      .returning();

    return coupon ?? null;
  }

  async redeemCoupon(id: string, executor?: DatabaseTransaction): Promise<Coupon | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [coupon] = await db
      .update(coupons)
      .set({ timesRedeemed: sql`${coupons.timesRedeemed} + 1` })
      .where(
        and(
          eq(coupons.id, id),
          eq(coupons.valid, true),
          isNull(coupons.deletedAt),
          or(
            isNull(coupons.maxRedemptions),
            sql`${coupons.timesRedeemed} < ${coupons.maxRedemptions}`,
          ),
        ),
      )
      .returning();

    return coupon ?? null;
  }

  async archiveCoupon(
    id: string,
    deletedAt: string,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(coupons)
      .set({ deletedAt, updatedAt: deletedAt, valid: false })
      .where(and(eq(coupons.id, id), isNull(coupons.deletedAt)));
  }
}
