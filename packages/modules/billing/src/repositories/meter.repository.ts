import type { MeterStatus } from '@contracts/meters.types';
import type { Meter, NewMeter } from '@database/schemas';
import { meters } from '@database/schemas';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { Database, DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import { NotFoundError } from '@vxrerp/platform/errors';
import type { RowCursor } from '@vxrerp/platform/repositories';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

export interface MeterFilters {
  eventName?: string;
  status?: MeterStatus;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class MeterRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getMeter(id: string): Promise<Meter> {
    const meter = await this.findMeter(id);

    if (meter) {
      return meter;
    }

    throw new NotFoundError(`No such meter: ${id}`);
  }

  async findMeter(id: string): Promise<Meter | null> {
    const [meter] = await this._db.master
      .select()
      .from(meters)
      .where(and(eq(meters.id, id), isNull(meters.deletedAt)))
      .limit(1);

    return meter ?? null;
  }

  async findMeters(filters: MeterFilters = {}, limit = DEFAULT_QUERY_LIMIT): Promise<Meter[]> {
    const where = and(
      isNull(meters.deletedAt),
      filters.eventName ? eq(meters.eventName, filters.eventName) : undefined,
      filters.status ? eq(meters.status, filters.status) : undefined,
      filters.beforeAt
        ? sql`(${meters.createdAt}, ${meters.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${meters.createdAt}, ${meters.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(meters)
      .where(where)
      .orderBy(desc(meters.createdAt), desc(meters.id))
      .limit(limit);
  }

  async createMeter(payload: NewMeter, executor?: DatabaseTransaction): Promise<Meter | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    const [meter] = await db.insert(meters).values(payload).returning();

    return meter ?? null;
  }

  async updateMeter(
    id: string,
    payload: Partial<NewMeter>,
    executor?: DatabaseTransaction,
  ): Promise<Meter | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    const [meter] = await db
      .update(meters)
      .set(payload)
      .where(and(eq(meters.id, id), isNull(meters.deletedAt)))
      .returning();

    return meter ?? null;
  }
}
