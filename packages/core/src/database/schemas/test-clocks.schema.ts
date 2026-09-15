import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import type { TestClockStatus } from '@contracts/test-clocks.types';

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
  (table) => [index('test_clocks_created_at_id_idx').on(table.createdAt, table.id)],
);

export type TestClockEntity = typeof testClocks.$inferSelect;
export type NewTestClockEntity = typeof testClocks.$inferInsert;
