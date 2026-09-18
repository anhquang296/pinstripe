import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { DisputeStatus } from '@contracts/disputes.types';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { Dispute, NewDispute } from '@database/schemas';
import { disputes } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

export interface DisputeFilters {
  livemode?: boolean;
  chargeId?: string;
  customerId?: string;
  pspReference?: string;
  status?: DisputeStatus;
  statuses?: readonly DisputeStatus[];
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class DisputeRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findDispute(id: string): Promise<Dispute | null> {
    const [dispute] = await this._db.master
      .select()
      .from(disputes)
      .where(eq(disputes.id, id))
      .limit(1);

    return dispute ?? null;
  }

  async findDisputes(
    filters: DisputeFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<Dispute[]> {
    const where = and(
      filters.livemode === undefined ? undefined : eq(disputes.livemode, filters.livemode),
      filters.chargeId ? eq(disputes.chargeId, filters.chargeId) : undefined,
      filters.customerId ? eq(disputes.customerId, filters.customerId) : undefined,
      filters.pspReference ? eq(disputes.pspReference, filters.pspReference) : undefined,
      filters.status ? eq(disputes.status, filters.status) : undefined,
      filters.statuses ? inArray(disputes.status, [...filters.statuses]) : undefined,
      filters.beforeAt
        ? sql`(${disputes.createdAt}, ${disputes.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${disputes.createdAt}, ${disputes.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(disputes)
      .where(where)
      .orderBy(desc(disputes.createdAt), desc(disputes.id))
      .limit(limit);
  }

  async createDispute(
    payload: NewDispute,
    executor?: DatabaseTransaction,
  ): Promise<Dispute | null> {
    const db = executor ?? this._db.master;
    const [dispute] = await db.insert(disputes).values(payload).returning();

    return dispute ?? null;
  }

  async updateDispute(
    id: string,
    payload: Partial<NewDispute>,
    executor?: DatabaseTransaction,
  ): Promise<Dispute | null> {
    const db = executor ?? this._db.master;
    const [dispute] = await db.update(disputes).set(payload).where(eq(disputes.id, id)).returning();

    return dispute ?? null;
  }
}
