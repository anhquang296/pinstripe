import type { PostingDirection } from '@contracts/ledger.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { ledgerAccounts } from '@database/schemas/ledger-accounts.schema';
import type { Currency } from '@utils/currency';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const ledgerTransactions = pgTable(
  'ledger_transactions',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    description: text('description').notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    externalId: text('external_id'),
    effectiveAt: isoTimestamp('effective_at').notNull(),
    reversesTransactionId: text('reverses_transaction_id'),
    reversedByTransactionId: text('reversed_by_transaction_id'),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      uniqueIndex('ledger_transactions_external_id_idx').on(table.livemode, table.externalId),
      index('ledger_transactions_created_at_id_idx').on(table.createdAt, table.id),
      index('ledger_transactions_effective_at_idx').on(table.effectiveAt),
    ];
  },
);

export const ledgerPostings = pgTable(
  'ledger_postings',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => {
        return ledgerTransactions.id;
      }),
    accountId: text('account_id')
      .notNull()
      .references(() => {
        return ledgerAccounts.id;
      }),
    direction: text('direction').$type<PostingDirection>().notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      index('ledger_postings_transaction_id_idx').on(table.transactionId),
      index('ledger_postings_account_id_idx').on(table.accountId),
      check('ledger_postings_amount_positive', sql`${table.amount} > 0`),
    ];
  },
);

export type LedgerTransaction = typeof ledgerTransactions.$inferSelect;
export type NewLedgerTransaction = typeof ledgerTransactions.$inferInsert;
export type LedgerPosting = typeof ledgerPostings.$inferSelect;
export type NewLedgerPosting = typeof ledgerPostings.$inferInsert;
