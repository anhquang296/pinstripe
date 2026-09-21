import type {
  LedgerAccountCode,
  LedgerAccountType,
  PostingDirection,
} from '@contracts/ledger.types';
import { billingPgSchema } from '@database/schemas/pg-schema.schema';
import type { Currency } from '@utils/currency';
import { isoTimestamp } from '@vxrerp/platform/database';
import { sql } from 'drizzle-orm';
import { bigint, index, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const ledgerAccounts = billingPgSchema.table(
  'ledger_accounts',
  {
    id: text('id').primaryKey(),
    code: text('code').$type<LedgerAccountCode>().notNull(),
    type: text('type').$type<LedgerAccountType>().notNull(),
    normalBalance: text('normal_balance').$type<PostingDirection>().notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    customerId: text('customer_id'),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
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

export const ledgerAccountBalances = billingPgSchema
  .view('ledger_account_balances', {
    accountId: text('account_id').notNull(),
    debits: bigint('debits', { mode: 'number' }).notNull(),
    credits: bigint('credits', { mode: 'number' }).notNull(),
    balance: bigint('balance', { mode: 'number' }).notNull(),
  })
  .existing();

export type LedgerAccount = typeof ledgerAccounts.$inferSelect;
export type NewLedgerAccount = typeof ledgerAccounts.$inferInsert;
