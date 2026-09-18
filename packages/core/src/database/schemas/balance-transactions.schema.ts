import type { BalanceSourceType, BalanceTransactionType } from '@contracts/balance.types';
import type { Currency } from '@utils/currency';
import { bigint, boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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
    availableOn: timestamp('available_on', { withTimezone: true }).notNull(),
    sourceType: text('source_type').$type<BalanceSourceType>().notNull(),
    sourceId: text('source_id').notNull(),
    payoutId: text('payout_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
