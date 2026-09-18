import type {
  CheckoutPaymentStatus,
  CheckoutSessionMode,
  CheckoutSessionStatus,
} from '@contracts/checkout.types';
import { customers } from '@database/schemas/customers.schema';
import { invoices } from '@database/schemas/invoices.schema';
import { paymentLinks } from '@database/schemas/payment-links.schema';
import { paymentIntents, setupIntents } from '@database/schemas/payments.schema';
import { prices } from '@database/schemas/prices.schema';
import { subscriptions } from '@database/schemas/subscriptions.schema';
import type { Currency } from '@utils/currency';
import { bigint, boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const checkoutSessions = pgTable(
  'checkout_sessions',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    mode: text('mode').$type<CheckoutSessionMode>().notNull(),
    status: text('status').$type<CheckoutSessionStatus>().notNull(),
    paymentStatus: text('payment_status').$type<CheckoutPaymentStatus>().notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    currency: text('currency').$type<Currency>().notNull(),
    amountSubtotal: bigint('amount_subtotal', { mode: 'number' }).notNull().default(0),
    amountTotal: bigint('amount_total', { mode: 'number' }).notNull().default(0),
    successUrl: text('success_url').notNull(),
    cancelUrl: text('cancel_url'),
    url: text('url'),
    clientReferenceId: text('client_reference_id'),
    paymentLinkId: text('payment_link_id').references(() => {
      return paymentLinks.id;
    }),
    subscriptionId: text('subscription_id').references(() => {
      return subscriptions.id;
    }),
    invoiceId: text('invoice_id').references(() => {
      return invoices.id;
    }),
    paymentIntentId: text('payment_intent_id').references(() => {
      return paymentIntents.id;
    }),
    setupIntentId: text('setup_intent_id').references(() => {
      return setupIntents.id;
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('checkout_sessions_customer_id_idx').on(table.customerId),
      index('checkout_sessions_status_expires_at_idx').on(table.status, table.expiresAt),
      index('checkout_sessions_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export const checkoutSessionLineItems = pgTable(
  'checkout_session_line_items',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    checkoutSessionId: text('checkout_session_id')
      .notNull()
      .references(() => {
        return checkoutSessions.id;
      }),
    priceId: text('price_id')
      .notNull()
      .references(() => {
        return prices.id;
      }),
    quantity: bigint('quantity', { mode: 'number' }).notNull(),
    amountSubtotal: bigint('amount_subtotal', { mode: 'number' }).notNull(),
    amountTotal: bigint('amount_total', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [index('checkout_session_line_items_session_id_idx').on(table.checkoutSessionId)];
  },
);

export type CheckoutSession = typeof checkoutSessions.$inferSelect;
export type NewCheckoutSession = typeof checkoutSessions.$inferInsert;
export type CheckoutSessionLineItem = typeof checkoutSessionLineItems.$inferSelect;
export type NewCheckoutSessionLineItem = typeof checkoutSessionLineItems.$inferInsert;
