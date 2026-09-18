import type { TestClockStatus } from '@contracts/test-clocks.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text } from 'drizzle-orm/pg-core';

export const testClocks = pgTable(
  'test_clocks',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull().default(false),
    name: text('name').notNull(),
    frozenTime: isoTimestamp('frozen_time').notNull(),
    status: text('status').$type<TestClockStatus>().notNull(),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      index('test_clocks_created_at_id_idx').on(table.createdAt, table.id),
      check('test_clocks_livemode_false', sql`livemode = false`),
    ];
  },
);

export type TestClock = typeof testClocks.$inferSelect;
export type NewTestClock = typeof testClocks.$inferInsert;
