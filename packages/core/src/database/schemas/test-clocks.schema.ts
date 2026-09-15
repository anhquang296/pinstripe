import type { TestClockStatus } from '@contracts/test-clocks.types';
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const testClocks = pgTable(
  'test_clocks',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    frozenTime: timestamp('frozen_time', { withTimezone: true }).notNull(),
    status: text('status').$type<TestClockStatus>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [index('test_clocks_created_at_id_idx').on(table.createdAt, table.id)];
  },
);

export type TestClock = typeof testClocks.$inferSelect;
export type NewTestClock = typeof testClocks.$inferInsert;
