import type {
  BillingReason,
  CreditNoteStatus,
  CreditNoteType,
  InvoiceStatus,
  NumberSequence,
} from '@contracts/invoices.types';
import type { CollectionMethod } from '@contracts/subscriptions.types';
import type { AuthorityStatus, AutomaticTaxStatus, TaxType } from '@contracts/taxes.types';
import { AuthorityStatusEnum, AutomaticTaxStatusEnum } from '@contracts/taxes.types';
import { customers } from '@database/schemas/customers.schema';
import { prices } from '@database/schemas/prices.schema';
import { subscriptions } from '@database/schemas/subscriptions.schema';
import { taxRates } from '@database/schemas/taxes.schema';
import type { Currency } from '@utils/currency';
import type { LineItemType } from '@utils/rating';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export interface InvoiceLineDiscountAmount {
  discountId: string;
  amount: number;
}

export const numberSequences = pgTable(
  'number_sequences',
  {
    livemode: boolean('livemode').notNull(),
    name: text('name').$type<NumberSequence>().notNull(),
    nextValue: integer('next_value').notNull().default(1),
  },
  (table) => {
    return [primaryKey({ columns: [table.livemode, table.name] })];
  },
);

export const invoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
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
    collectionMethod: text('collection_method').$type<CollectionMethod>().notNull(),
    autoAdvance: boolean('auto_advance').notNull().default(true),
    daysUntilDue: integer('days_until_due'),
    attempted: boolean('attempted').notNull().default(false),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    subtotal: bigint('subtotal', { mode: 'number' }).notNull().default(0),
    subtotalExcludingTax: bigint('subtotal_excluding_tax', { mode: 'number' }).notNull().default(0),
    totalDiscountAmount: bigint('total_discount_amount', { mode: 'number' }).notNull().default(0),
    totalTaxAmount: bigint('total_tax_amount', { mode: 'number' }).notNull().default(0),
    total: bigint('total', { mode: 'number' }).notNull().default(0),
    startingBalance: bigint('starting_balance', { mode: 'number' }).notNull().default(0),
    endingBalance: bigint('ending_balance', { mode: 'number' }).notNull().default(0),
    amountDue: bigint('amount_due', { mode: 'number' }).notNull().default(0),
    amountPaid: bigint('amount_paid', { mode: 'number' }).notNull().default(0),
    defaultTaxRates: jsonb('default_tax_rates').$type<string[]>().notNull().default([]),
    automaticTaxEnabled: boolean('automatic_tax_enabled').notNull().default(false),
    automaticTaxStatus: text('automatic_tax_status')
      .$type<AutomaticTaxStatus>()
      .notNull()
      .default(AutomaticTaxStatusEnum.NOT_COLLECTING),
    authorityInvoiceNumber: text('authority_invoice_number'),
    authorityStatus: text('authority_status')
      .$type<AuthorityStatus>()
      .notNull()
      .default(AuthorityStatusEnum.NOT_SUBMITTED),
    hostedInvoiceUrl: text('hosted_invoice_url'),
    invoicePdf: text('invoice_pdf'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
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
      uniqueIndex('invoices_number_idx').on(table.livemode, table.number),
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
    livemode: boolean('livemode').notNull(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => {
        return invoices.id;
      }),
    subscriptionItemId: text('subscription_item_id'),
    subscriptionItemChangeId: text('subscription_item_change_id'),
    invoiceItemId: text('invoice_item_id'),
    priceId: text('price_id').references(() => {
      return prices.id;
    }),
    type: text('type').$type<LineItemType>().notNull(),
    description: text('description').notNull().default(''),
    quantity: doublePrecision('quantity').notNull(),
    unitAmount: bigint('unit_amount', { mode: 'number' }),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    amountExcludingTax: bigint('amount_excluding_tax', { mode: 'number' }).notNull().default(0),
    discountable: boolean('discountable').notNull().default(true),
    discountAmounts: jsonb('discount_amounts')
      .$type<InvoiceLineDiscountAmount[]>()
      .notNull()
      .default([]),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    prorationFactor: doublePrecision('proration_factor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [index('invoice_line_items_invoice_id_idx').on(table.invoiceId)];
  },
);

export const invoiceLineItemTaxAmounts = pgTable(
  'invoice_line_item_tax_amounts',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => {
        return invoices.id;
      }),
    invoiceLineItemId: text('invoice_line_item_id')
      .notNull()
      .references(() => {
        return invoiceLineItems.id;
      }),
    taxRateId: text('tax_rate_id')
      .notNull()
      .references(() => {
        return taxRates.id;
      }),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    taxableAmount: bigint('taxable_amount', { mode: 'number' }).notNull(),
    isInclusive: boolean('is_inclusive').notNull(),
    percentage: doublePrecision('percentage').notNull(),
    taxType: text('tax_type').$type<TaxType>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('invoice_line_item_tax_amounts_invoice_id_idx').on(table.invoiceId),
      index('invoice_line_item_tax_amounts_line_item_id_idx').on(table.invoiceLineItemId),
    ];
  },
);

export const creditNotes = pgTable(
  'credit_notes',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
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
    type: text('type').$type<CreditNoteType>().notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    refundAmount: bigint('refund_amount', { mode: 'number' }).notNull().default(0),
    outOfBandAmount: bigint('out_of_band_amount', { mode: 'number' }).notNull().default(0),
    creditAmount: bigint('credit_amount', { mode: 'number' }).notNull().default(0),
    refundId: text('refund_id'),
    ledgerTransactionId: text('ledger_transaction_id'),
    reason: text('reason').notNull(),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('credit_notes_invoice_id_idx').on(table.invoiceId),
      index('credit_notes_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('credit_notes_number_idx').on(table.livemode, table.number),
    ];
  },
);

export const creditNoteLineItems = pgTable(
  'credit_note_line_items',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    creditNoteId: text('credit_note_id')
      .notNull()
      .references(() => {
        return creditNotes.id;
      }),
    invoiceLineItemId: text('invoice_line_item_id').references(() => {
      return invoiceLineItems.id;
    }),
    description: text('description').notNull().default(''),
    quantity: doublePrecision('quantity').notNull().default(1),
    unitAmount: bigint('unit_amount', { mode: 'number' }),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [index('credit_note_line_items_credit_note_id_idx').on(table.creditNoteId)];
  },
);

export const creditNoteTransitions = pgTable(
  'credit_note_transitions',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    creditNoteId: text('credit_note_id')
      .notNull()
      .references(() => {
        return creditNotes.id;
      }),
    status: text('status').$type<CreditNoteStatus>().notNull(),
    reason: text('reason'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('credit_note_transitions_credit_note_id_idx').on(table.creditNoteId),
      index('credit_note_transitions_occurred_at_id_idx').on(table.occurredAt, table.id),
    ];
  },
);

export const invoiceItems = pgTable(
  'invoice_items',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    invoiceId: text('invoice_id').references(() => {
      return invoices.id;
    }),
    subscriptionId: text('subscription_id').references(() => {
      return subscriptions.id;
    }),
    priceId: text('price_id').references(() => {
      return prices.id;
    }),
    currency: text('currency').$type<Currency>().notNull(),
    description: text('description').notNull().default(''),
    quantity: doublePrecision('quantity').notNull().default(1),
    unitAmount: bigint('unit_amount', { mode: 'number' }),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    discountable: boolean('discountable').notNull().default(true),
    taxRates: jsonb('tax_rates').$type<string[]>().notNull().default([]),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => {
    return [
      index('invoice_items_customer_id_idx').on(table.customerId),
      index('invoice_items_invoice_id_idx').on(table.invoiceId),
      index('invoice_items_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export const invoicePayments = pgTable(
  'invoice_payments',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => {
        return invoices.id;
      }),
    paymentIntentId: text('payment_intent_id'),
    chargeId: text('charge_id'),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    settlementReference: text('settlement_reference'),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('invoice_payments_invoice_id_idx').on(table.invoiceId),
      index('invoice_payments_payment_intent_id_idx').on(table.paymentIntentId),
      uniqueIndex('invoice_payments_settlement_reference_idx')
        .on(table.livemode, table.settlementReference)
        .where(sql`settlement_reference is not null`),
    ];
  },
);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;
export type InvoiceLineItemTaxAmount = typeof invoiceLineItemTaxAmounts.$inferSelect;
export type NewInvoiceLineItemTaxAmount = typeof invoiceLineItemTaxAmounts.$inferInsert;
export type CreditNote = typeof creditNotes.$inferSelect;
export type NewCreditNote = typeof creditNotes.$inferInsert;
export type CreditNoteLineItem = typeof creditNoteLineItems.$inferSelect;
export type NewCreditNoteLineItem = typeof creditNoteLineItems.$inferInsert;
export type CreditNoteTransition = typeof creditNoteTransitions.$inferSelect;
export type NewCreditNoteTransition = typeof creditNoteTransitions.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type NewInvoicePayment = typeof invoicePayments.$inferInsert;
