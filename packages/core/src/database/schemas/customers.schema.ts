import type {
  CustomerBalanceTransactionType,
  CustomerResponse as CustomerContract,
} from '@contracts/customers.types';
import type { TaxExempt } from '@contracts/taxes.types';
import { TaxExemptEnum } from '@contracts/taxes.types';
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
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const customers = pgTable(
  'customers',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    email: text('email'),
    name: text('name').notNull().default(''),
    description: text('description').notNull().default(''),
    phone: text('phone').notNull().default(''),
    taxId: text('tax_id'),
    taxExempt: text('tax_exempt').$type<TaxExempt>().notNull().default(TaxExemptEnum.NONE),
    address: jsonb('address').$type<NonNullable<CustomerContract['address']>>(),
    currency: text('currency').$type<Currency>().notNull(),
    testClockId: text('test_clock_id'),
    balance: bigint('balance', { mode: 'number' }).notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => {
    return [
      index('customers_created_at_id_idx').on(table.createdAt, table.id),
      check('customers_test_clock_is_test_mode', sql`test_clock_id is null or livemode = false`),
      uniqueIndex('customers_email_idx')
        .on(table.livemode, table.email)
        .where(sql`deleted_at is null and email is not null`),
    ];
  },
);

export const customerBalanceTransactions = pgTable(
  'customer_balance_transactions',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    invoiceId: text('invoice_id'),
    creditNoteId: text('credit_note_id'),
    type: text('type').$type<CustomerBalanceTransactionType>().notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    endingBalance: bigint('ending_balance', { mode: 'number' }).notNull(),
    description: text('description').notNull().default(''),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('customer_balance_transactions_customer_id_idx').on(table.customerId),
      index('customer_balance_transactions_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('customer_balance_transactions_invoice_idx')
        .on(table.invoiceId, table.type)
        .where(sql`invoice_id is not null`),
    ];
  },
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerBalanceTransaction = typeof customerBalanceTransactions.$inferSelect;
export type NewCustomerBalanceTransaction = typeof customerBalanceTransactions.$inferInsert;
