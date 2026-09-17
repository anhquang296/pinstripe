import type { AggregateType, DomainEventType } from '@contracts/events.types';
import { OutboxStatusEnum } from '@contracts/events.types';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewOutboxEvent, OutboxEvent } from '@database/schemas';
import { outboxEvents } from '@database/schemas';
import { eq, inArray, sql } from 'drizzle-orm';
import _ from 'lodash';

interface ClaimedOutboxEventRow {
  [column: string]: unknown;
  id: string;
  livemode: boolean;
  aggregateType: AggregateType;
  aggregateId: string;
  eventType: DomainEventType;
  payload: Record<string, unknown>;
  attemptCount: number;
  occurredAt: string | Date;
}

export interface ClaimedOutboxEvent {
  id: string;
  livemode: boolean;
  aggregateType: AggregateType;
  aggregateId: string;
  eventType: DomainEventType;
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
    if (_.isEmpty(payloads)) {
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
        livemode,
        aggregate_type as "aggregateType",
        aggregate_id as "aggregateId",
        event_type as "eventType",
        payload,
        attempt_count as "attemptCount",
        occurred_at as "occurredAt"
    `);

    return _.map([...claimed], (row) => {
      return {
        id: row.id,
        livemode: row.livemode,
        aggregateType: row.aggregateType,
        aggregateId: row.aggregateId,
        eventType: row.eventType,
        payload: row.payload,
        attemptCount: row.attemptCount,
        occurredAt: new Date(row.occurredAt),
      };
    });
  }

  async publishOutboxEvents(ids: readonly string[], publishedAt: Date): Promise<void> {
    if (_.isEmpty(ids)) {
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
