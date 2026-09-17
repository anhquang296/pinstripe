import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { DomainEventType } from '@contracts/events.types';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { Event, NewEvent } from '@database/schemas';
import { events } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, desc, eq, sql } from 'drizzle-orm';

export interface EventFilters {
  livemode?: boolean;
  type?: DomainEventType;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class EventRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findEvent(id: string): Promise<Event | null> {
    const [event] = await this._db.master.select().from(events).where(eq(events.id, id)).limit(1);

    return event ?? null;
  }

  async findEvents(filters: EventFilters = {}, limit = DEFAULT_QUERY_LIMIT): Promise<Event[]> {
    const where = and(
      filters.livemode === undefined ? undefined : eq(events.livemode, filters.livemode),
      filters.type ? eq(events.type, filters.type) : undefined,
      filters.beforeAt
        ? sql`(${events.createdAt}, ${events.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${events.createdAt}, ${events.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(events)
      .where(where)
      .orderBy(desc(events.createdAt), desc(events.id))
      .limit(limit);
  }

  async createEvent(payload: NewEvent, executor?: DatabaseTransaction): Promise<Event | null> {
    const db = executor ?? this._db.master;
    const [event] = await db.insert(events).values(payload).onConflictDoNothing().returning();

    return event ?? null;
  }
}
