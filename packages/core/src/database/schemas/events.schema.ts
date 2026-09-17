import type { DomainEventType } from '@contracts/events.types';
import { boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    type: text('type').$type<DomainEventType>().notNull(),
    apiVersion: text('api_version').notNull(),
    data: jsonb('data').$type<{ object: unknown }>().notNull(),
    requestId: text('request_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('events_created_at_id_idx').on(table.createdAt, table.id),
      index('events_type_idx').on(table.type),
    ];
  },
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
