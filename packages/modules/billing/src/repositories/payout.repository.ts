import type { PayoutStatus } from '@contracts/payouts.types';
import type { NewPayout, Payout } from '@database/schemas';
import { payouts } from '@database/schemas';
import type { Currency } from '@utils/currency';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import { NotFoundError } from '@vxrerp/platform/errors';
import type { RowCursor } from '@vxrerp/platform/repositories';
import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';

export interface PayoutFilters {
  currency?: Currency;
  status?: PayoutStatus;
  statuses?: readonly PayoutStatus[];
  pspReference?: string;
  arrivalBeforeAt?: string;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class PayoutRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getPayout(id: string): Promise<Payout> {
    const payout = await this.findPayout(id);

    if (payout) {
      return payout;
    }

    throw new NotFoundError(`No such payout: ${id}`);
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
      filters.currency ? eq(payouts.currency, filters.currency) : undefined,
      filters.status ? eq(payouts.status, filters.status) : undefined,
      filters.statuses ? inArray(payouts.status, [...filters.statuses]) : undefined,
      filters.pspReference ? eq(payouts.pspReference, filters.pspReference) : undefined,
      filters.arrivalBeforeAt ? lte(payouts.arrivalAt, filters.arrivalBeforeAt) : undefined,
      filters.beforeAt
        ? sql`(${payouts.createdAt}, ${payouts.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${payouts.createdAt}, ${payouts.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
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
