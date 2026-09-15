import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { PostingDirection } from '@contracts/ledger.types';
import type { Currency } from '@utils/currency';
import { ledgerAccounts } from '@database/schemas/ledger-accounts.schema';

export const ledgerTransactions = pgTable(
  'ledger_transactions',
  {
    id: text('id').primaryKey(),
    description: text('description').notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    externalId: text('external_id'),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    reversesTransactionId: text('reverses_transaction_id'),
    reversedByTransactionId: text('reversed_by_transaction_id'),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('ledger_transactions_external_id_idx').on(table.externalId),
    index('ledger_transactions_created_at_id_idx').on(table.createdAt, table.id),
    index('ledger_transactions_effective_at_idx').on(table.effectiveAt),
  ],
);

export const ledgerPostings = pgTable(
  'ledger_postings',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => ledgerTransactions.id),
    accountId: text('account_id')
      .notNull()
      .references(() => ledgerAccounts.id),
    direction: text('direction').$type<PostingDirection>().notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ledger_postings_transaction_id_idx').on(table.transactionId),
    index('ledger_postings_account_id_idx').on(table.accountId),
    check('ledger_postings_amount_positive', sql`${table.amount} > 0`),
  ],
);

export type LedgerTransactionEntity = typeof ledgerTransactions.$inferSelect;
export type NewLedgerTransactionEntity = typeof ledgerTransactions.$inferInsert;
export type LedgerPostingEntity = typeof ledgerPostings.$inferSelect;
export type NewLedgerPostingEntity = typeof ledgerPostings.$inferInsert;
