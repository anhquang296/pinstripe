import type { BillingReason, InvoiceStatus, NumberSequence } from '@contracts/invoices.types';
import { customers } from '@database/schemas/customers.schema';
import { prices } from '@database/schemas/prices.schema';
import { subscriptions } from '@database/schemas/subscriptions.schema';
import type { Currency } from '@utils/currency';
import type { LineItemType } from '@utils/rating';
import { sql } from 'drizzle-orm';
import {
  bigint,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const numberSequences = pgTable('number_sequences', {
  name: text('name').$type<NumberSequence>().primaryKey(),
  nextValue: integer('next_value').notNull().default(1),
});

export const invoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    number: text('number'),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    subscriptionId: text('subscription_id').references(() => {
      return subscriptions.id;
    }),
    status: text('status').$type<InvoiceStatus>().notNull(),
    billingReason: text('billing_reason').$type<BillingReason>().notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    subtotal: bigint('subtotal', { mode: 'number' }).notNull().default(0),
    total: bigint('total', { mode: 'number' }).notNull().default(0),
    amountPaid: bigint('amount_paid', { mode: 'number' }).notNull().default(0),
    dueAt: timestamp('due_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('invoices_customer_id_idx').on(table.customerId),
      index('invoices_status_idx').on(table.status),
      index('invoices_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('invoices_number_idx').on(table.number),
      uniqueIndex('invoices_subscription_cycle_period_idx')
        .on(table.subscriptionId, table.periodStart)
        .where(sql`${table.billingReason} = 'subscription_cycle'`),
      index('invoices_status_next_attempt_at_idx').on(table.status, table.nextAttemptAt),
    ];
  },
);

export const invoiceLineItems = pgTable(
  'invoice_line_items',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => {
        return invoices.id;
      }),
    subscriptionItemId: text('subscription_item_id'),
    priceId: text('price_id')
      .notNull()
      .references(() => {
        return prices.id;
      }),
    type: text('type').$type<LineItemType>().notNull(),
    quantity: doublePrecision('quantity').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    prorationFactor: doublePrecision('proration_factor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [index('invoice_line_items_invoice_id_idx').on(table.invoiceId)];
  },
);

export const creditNotes = pgTable(
  'credit_notes',
  {
    id: text('id').primaryKey(),
    number: text('number').notNull(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => {
        return invoices.id;
      }),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    currency: text('currency').$type<Currency>().notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    reason: text('reason').notNull(),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('credit_notes_invoice_id_idx').on(table.invoiceId),
      index('credit_notes_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('credit_notes_number_idx').on(table.number),
    ];
  },
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;
export type CreditNote = typeof creditNotes.$inferSelect;
export type NewCreditNote = typeof creditNotes.$inferInsert;
