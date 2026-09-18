import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { PayoutStatus } from '@contracts/payouts.types';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewPayout, Payout } from '@database/schemas';
import { payouts } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import type { Currency } from '@utils/currency';
import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';

export interface PayoutFilters {
  livemode?: boolean;
  currency?: Currency;
  status?: PayoutStatus;
  statuses?: readonly PayoutStatus[];
  pspReference?: string;
  arrivalBeforeAt?: Date;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class PayoutRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findPayout(id: string): Promise<Payout | null> {
    const [payout] = await this._db.master
      .select()
      .from(payouts)
      .where(eq(payouts.id, id))
      .limit(1);

    return payout ?? null;
  }

  async findPayouts(filters: PayoutFilters = {}, limit = DEFAULT_QUERY_LIMIT): Promise<Payout[]> {
    const where = and(
      filters.livemode === undefined ? undefined : eq(payouts.livemode, filters.livemode),
      filters.currency ? eq(payouts.currency, filters.currency) : undefined,
      filters.status ? eq(payouts.status, filters.status) : undefined,
      filters.statuses ? inArray(payouts.status, [...filters.statuses]) : undefined,
      filters.pspReference ? eq(payouts.pspReference, filters.pspReference) : undefined,
      filters.arrivalBeforeAt ? lte(payouts.arrivalAt, filters.arrivalBeforeAt) : undefined,
      filters.beforeAt
        ? sql`(${payouts.createdAt}, ${payouts.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${payouts.createdAt}, ${payouts.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(payouts)
      .where(where)
      .orderBy(desc(payouts.createdAt), desc(payouts.id))
      .limit(limit);
  }

  async createPayout(payload: NewPayout, executor?: DatabaseTransaction): Promise<Payout | null> {
    const db = executor ?? this._db.master;
    const [payout] = await db.insert(payouts).values(payload).returning();

    return payout ?? null;
  }

  async updatePayout(
    id: string,
    payload: Partial<NewPayout>,
    executor?: DatabaseTransaction,
  ): Promise<Payout | null> {
    const db = executor ?? this._db.master;
    const [payout] = await db.update(payouts).set(payload).where(eq(payouts.id, id)).returning();

    return payout ?? null;
  }
}
