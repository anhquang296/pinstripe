import type {
  LedgerAccountCode,
  LedgerAccountType,
  PostingDirection,
} from '@contracts/ledger.types';
import type { Currency } from '@utils/currency';
import { sql } from 'drizzle-orm';
import { bigint, index, pgTable, pgView, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const ledgerAccounts = pgTable(
  'ledger_accounts',
  {
    id: text('id').primaryKey(),
    code: text('code').$type<LedgerAccountCode>().notNull(),
    type: text('type').$type<LedgerAccountType>().notNull(),
    normalBalance: text('normal_balance').$type<PostingDirection>().notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    customerId: text('customer_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      uniqueIndex('ledger_accounts_code_currency_customer_id_idx')
        .on(table.code, table.currency, table.customerId)
        .where(sql`customer_id is not null`),
      uniqueIndex('ledger_accounts_code_currency_idx')
        .on(table.code, table.currency)
        .where(sql`customer_id is null`),
      index('ledger_accounts_customer_id_idx').on(table.customerId),
    ];
  },
);

export const ledgerAccountBalances = pgView('ledger_account_balances', {
  accountId: text('account_id').notNull(),
  debits: bigint('debits', { mode: 'number' }).notNull(),
  credits: bigint('credits', { mode: 'number' }).notNull(),
  balance: bigint('balance', { mode: 'number' }).notNull(),
}).existing();

export type LedgerAccount = typeof ledgerAccounts.$inferSelect;
export type NewLedgerAccount = typeof ledgerAccounts.$inferInsert;
