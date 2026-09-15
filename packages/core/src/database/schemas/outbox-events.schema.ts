import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export enum OutboxStatusEnum {
  PENDING = 'pending',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
}
export type OutboxStatus = `${OutboxStatusEnum}`;

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: text('id').primaryKey(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: text('status').$type<OutboxStatus>().notNull().default(OutboxStatusEnum.PENDING),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('outbox_events_status_occurred_at_idx').on(table.status, table.occurredAt),
    index('outbox_events_aggregate_type_aggregate_id_idx').on(
      table.aggregateType,
      table.aggregateId,
    ),
  ],
);

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
