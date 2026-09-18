import type { BalanceSourceType, BalanceTransactionType } from '@contracts/balance.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import type { Currency } from '@utils/currency';
import { sql } from 'drizzle-orm';
import { bigint, boolean, index, pgTable, text } from 'drizzle-orm/pg-core';

export const balanceTransactions = pgTable(
  'balance_transactions',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    type: text('type').$type<BalanceTransactionType>().notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    gross: bigint('gross', { mode: 'number' }).notNull(),
    fee: bigint('fee', { mode: 'number' }).notNull().default(0),
    net: bigint('net', { mode: 'number' }).notNull(),
    availableOn: isoTimestamp('available_on').notNull(),
    sourceType: text('source_type').$type<BalanceSourceType>().notNull(),
    sourceId: text('source_id').notNull(),
    payoutId: text('payout_id'),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      index('balance_transactions_source_idx').on(table.sourceType, table.sourceId),
      index('balance_transactions_payout_id_idx').on(table.payoutId),
      index('balance_transactions_available_on_idx').on(table.availableOn),
      index('balance_transactions_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export type BalanceTransaction = typeof balanceTransactions.$inferSelect;
export type NewBalanceTransaction = typeof balanceTransactions.$inferInsert;
