import type { MeterAggregation, MeterStatus } from '@contracts/meters.types';
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const meters = pgTable(
  'meters',
  {
    id: text('id').primaryKey(),
    displayName: text('display_name').notNull(),
    eventName: text('event_name').notNull(),
    aggregation: text('aggregation').$type<MeterAggregation>().notNull(),
    valueKey: text('value_key').notNull(),
    status: text('status').$type<MeterStatus>().notNull(),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => {
    return [
      uniqueIndex('meters_event_name_idx')
        .on(table.eventName)
        .where(sql`deleted_at is null`),
      index('meters_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export type Meter = typeof meters.$inferSelect;
export type NewMeter = typeof meters.$inferInsert;
