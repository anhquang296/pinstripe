import type { PayoutStatus } from '@contracts/payouts.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import type { Currency } from '@utils/currency';
import { sql } from 'drizzle-orm';
import { bigint, boolean, index, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const payouts = pgTable(
  'payouts',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    status: text('status').$type<PayoutStatus>().notNull(),
    statementDescriptor: text('statement_descriptor'),
    arrivalAt: isoTimestamp('arrival_at').notNull(),
    paidAt: isoTimestamp('paid_at'),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    pspReference: text('psp_reference'),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      index('payouts_status_idx').on(table.status),
      index('payouts_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('payouts_psp_reference_idx')
        .on(table.pspReference)
        .where(sql`psp_reference is not null`),
    ];
  },
);

export type Payout = typeof payouts.$inferSelect;
export type NewPayout = typeof payouts.$inferInsert;
