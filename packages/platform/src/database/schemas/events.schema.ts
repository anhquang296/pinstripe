import type { DomainEventType } from '@contracts/events.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { platformPgSchema } from '@database/schemas/pg-schema.schema';
import { sql } from 'drizzle-orm';
import { index, jsonb, text } from 'drizzle-orm/pg-core';

export const events = platformPgSchema.table(
  'events',
  {
    id: text('id').primaryKey(),
    type: text('type').$type<DomainEventType>().notNull(),
    apiVersion: text('api_version').notNull(),
    data: jsonb('data').$type<{ object: unknown }>().notNull(),
    requestId: text('request_id'),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
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
