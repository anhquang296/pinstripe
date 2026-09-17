import type { PaymentAttemptOutcome, PaymentIntentStatus } from '@contracts/payments.types';
import { customers } from '@database/schemas/customers.schema';
import { invoices } from '@database/schemas/invoices.schema';
import type { Currency } from '@utils/currency';
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const paymentIntents = pgTable(
  'payment_intents',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
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
    status: text('status').$type<PaymentIntentStatus>().notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    paymentMethod: text('payment_method'),
    pspReference: text('psp_reference'),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('payment_intents_invoice_id_idx').on(table.invoiceId),
      index('payment_intents_customer_id_idx').on(table.customerId),
      index('payment_intents_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('payment_intents_psp_reference_idx').on(table.pspReference),
    ];
  },
);

export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    paymentIntentId: text('payment_intent_id')
      .notNull()
      .references(() => {
        return paymentIntents.id;
      }),
    paymentMethod: text('payment_method').notNull(),
    outcome: text('outcome').$type<PaymentAttemptOutcome>().notNull(),
    pspReference: text('psp_reference'),
    failureCode: text('failure_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [index('payment_attempts_payment_intent_id_idx').on(table.paymentIntentId)];
  },
);

export const refunds = pgTable(
  'refunds',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    paymentIntentId: text('payment_intent_id')
      .notNull()
      .references(() => {
        return paymentIntents.id;
      }),
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
    pspReference: text('psp_reference').notNull(),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('refunds_invoice_id_idx').on(table.invoiceId),
      index('refunds_payment_intent_id_idx').on(table.paymentIntentId),
      index('refunds_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('refunds_psp_reference_idx').on(table.pspReference),
    ];
  },
);

export type PaymentIntent = typeof paymentIntents.$inferSelect;
export type NewPaymentIntent = typeof paymentIntents.$inferInsert;
export type PaymentAttempt = typeof paymentAttempts.$inferSelect;
export type NewPaymentAttempt = typeof paymentAttempts.$inferInsert;
export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;
