import type { TestClockStatus } from '@contracts/test-clocks.types';
import { billingPgSchema } from '@database/schemas/pg-schema.schema';
import { isoTimestamp } from '@vxrerp/platform/database';
import { sql } from 'drizzle-orm';
import { index, text } from 'drizzle-orm/pg-core';

export const testClocks = billingPgSchema.table(
  'test_clocks',
  {
    id: text('id').primaryKey(),
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
    return [index('test_clocks_created_at_id_idx').on(table.createdAt, table.id)];
  },
);

export type TestClock = typeof testClocks.$inferSelect;
export type NewTestClock = typeof testClocks.$inferInsert;
