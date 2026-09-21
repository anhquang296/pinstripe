import type { DomainEventType, OutboxStatus } from '@contracts/events.types';
import { OutboxStatusEnum } from '@contracts/events.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { platformPgSchema } from '@database/schemas/pg-schema.schema';
import { sql } from 'drizzle-orm';
import { index, integer, jsonb, text } from 'drizzle-orm/pg-core';

export const outboxEvents = platformPgSchema.table(
  'outbox_events',
  {
    id: text('id').primaryKey(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    eventType: text('event_type').$type<DomainEventType>().notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: text('status').$type<OutboxStatus>().notNull().default(OutboxStatusEnum.PENDING),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    occurredAt: isoTimestamp('occurred_at').notNull(),
    publishedAt: isoTimestamp('published_at'),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      index('outbox_events_status_occurred_at_idx').on(table.status, table.occurredAt),
      index('outbox_events_aggregate_type_aggregate_id_idx').on(
        table.aggregateType,
        table.aggregateId,
      ),
    ];
  },
);

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
