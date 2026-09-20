import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewPromotionCode, PromotionCode } from '@database/schemas';
import { promotionCodes } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';

export interface PromotionCodeFilters {
  couponId?: string;
  code?: string;
  active?: boolean;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class PromotionCodeRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getPromotionCode(id: string): Promise<PromotionCode> {
    const promotionCode = await this.findPromotionCode(id);

    if (promotionCode) {
      return promotionCode;
    }

    throw new NotFoundError(`No such promotion code: ${id}`);
  }

  async findPromotionCode(id: string): Promise<PromotionCode | null> {
    const [promotionCode] = await this._db.master
      .select()
      .from(promotionCodes)
      .where(eq(promotionCodes.id, id))
      .limit(1);

    return promotionCode ?? null;
  }

  async findPromotionCodes(
    filters: PromotionCodeFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<PromotionCode[]> {
    const where = and(
      filters.couponId ? eq(promotionCodes.couponId, filters.couponId) : undefined,
      filters.code ? eq(promotionCodes.code, filters.code) : undefined,
      filters.active === undefined ? undefined : eq(promotionCodes.active, filters.active),
      filters.beforeAt
        ? sql`(${promotionCodes.createdAt}, ${promotionCodes.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${promotionCodes.createdAt}, ${promotionCodes.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(promotionCodes)
      .where(where)
      .orderBy(asc(promotionCodes.createdAt), asc(promotionCodes.id))
      .limit(limit);
  }

  async createPromotionCode(
    payload: NewPromotionCode,
    executor?: DatabaseTransaction,
  ): Promise<PromotionCode | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    const [promotionCode] = await db.insert(promotionCodes).values(payload).returning();

    return promotionCode ?? null;
  }

  async updatePromotionCode(
    id: string,
    payload: Partial<NewPromotionCode>,
    executor?: DatabaseTransaction,
  ): Promise<PromotionCode | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    const [promotionCode] = await db
      .update(promotionCodes)
      .set(payload)
      .where(eq(promotionCodes.id, id))
      .returning();

    return promotionCode ?? null;
  }

  async redeemPromotionCode(
    id: string,
    executor?: DatabaseTransaction,
  ): Promise<PromotionCode | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    const [promotionCode] = await db
      .update(promotionCodes)
      .set({ timesRedeemed: sql`${promotionCodes.timesRedeemed} + 1` })
      .where(
        and(
          eq(promotionCodes.id, id),
          eq(promotionCodes.active, true),
          or(
            isNull(promotionCodes.maxRedemptions),
            sql`${promotionCodes.timesRedeemed} < ${promotionCodes.maxRedemptions}`,
          ),
        ),
      )
      .returning();

    return promotionCode ?? null;
  }
}
