import type { MeterAggregation, MeterStatus } from '@contracts/meters.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const meters = pgTable(
  'meters',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    displayName: text('display_name').notNull(),
    eventName: text('event_name').notNull(),
    aggregation: text('aggregation').$type<MeterAggregation>().notNull(),
    valueKey: text('value_key').notNull(),
    status: text('status').$type<MeterStatus>().notNull(),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
    deletedAt: isoTimestamp('deleted_at'),
  },
  (table) => {
    return [
      uniqueIndex('meters_event_name_idx')
        .on(table.livemode, table.eventName)
        .where(sql`deleted_at is null`),
      index('meters_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export type Meter = typeof meters.$inferSelect;
export type NewMeter = typeof meters.$inferInsert;
