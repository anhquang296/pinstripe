import { eq, inArray, sql } from 'drizzle-orm';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewOutboxEvent, OutboxEvent } from '@database/schemas';
import { OutboxStatusEnum, outboxEvents } from '@database/schemas';

interface ClaimedOutboxEventRow {
  [column: string]: unknown;
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  attemptCount: number;
  occurredAt: string | Date;
}

export interface ClaimedOutboxEvent {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  attemptCount: number;
  occurredAt: Date;
}

export class OutboxEventRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async createOutboxEvents(
    payloads: readonly NewOutboxEvent[],
    executor?: DatabaseTransaction,
  ): Promise<void> {
    if (payloads.length === 0) {
      return;
    }

    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db.insert(outboxEvents).values([...payloads]);
  }

  async findOutboxEvent(id: string): Promise<OutboxEvent | null> {
    const [event] = await this._db.master
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, id))
      .limit(1);

    return event ?? null;
  }

  async claimOutboxEvents(limit: number): Promise<ClaimedOutboxEvent[]> {
    const claimed = await this._db.master.execute<ClaimedOutboxEventRow>(sql`
      update ${outboxEvents}
      set status = ${OutboxStatusEnum.PUBLISHING}
      where id in (
        select id from ${outboxEvents}
        where status = ${OutboxStatusEnum.PENDING}
        order by occurred_at asc
        limit ${limit}
        for update skip locked
      )
      returning
        id,
        aggregate_type as "aggregateType",
        aggregate_id as "aggregateId",
        event_type as "eventType",
        payload,
        attempt_count as "attemptCount",
        occurred_at as "occurredAt"
    `);

    return [...claimed].map((row) => ({
      id: row.id,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      eventType: row.eventType,
      payload: row.payload,
      attemptCount: row.attemptCount,
      occurredAt: new Date(row.occurredAt),
    }));
  }

  async publishOutboxEvents(ids: readonly string[], publishedAt: Date): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this._db.master
      .update(outboxEvents)
      .set({ status: OutboxStatusEnum.PUBLISHED, publishedAt })
      .where(inArray(outboxEvents.id, [...ids]));
  }

  async failOutboxEvent(id: string, attemptCount: number, lastError: string): Promise<void> {
    await this._db.master
      .update(outboxEvents)
      .set({ status: OutboxStatusEnum.FAILED, attemptCount, lastError })
      .where(eq(outboxEvents.id, id));
  }
}
