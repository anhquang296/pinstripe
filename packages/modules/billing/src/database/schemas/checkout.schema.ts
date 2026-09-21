import type {
  CheckoutPaymentStatus,
  CheckoutSessionMode,
  CheckoutSessionStatus,
} from '@contracts/checkout.types';
import { customers } from '@database/schemas/customers.schema';
import { invoices } from '@database/schemas/invoices.schema';
import { paymentLinks } from '@database/schemas/payment-links.schema';
import { paymentIntents, setupIntents } from '@database/schemas/payments.schema';
import { billingPgSchema } from '@database/schemas/pg-schema.schema';
import { prices } from '@database/schemas/prices.schema';
import { subscriptions } from '@database/schemas/subscriptions.schema';
import type { Currency } from '@utils/currency';
import { isoTimestamp } from '@vxrerp/platform/database';
import { sql } from 'drizzle-orm';
import { bigint, index, jsonb, text } from 'drizzle-orm/pg-core';

export const checkoutSessions = billingPgSchema.table(
  'checkout_sessions',
  {
    id: text('id').primaryKey(),
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
    expiresAt: isoTimestamp('expires_at').notNull(),
    completedAt: isoTimestamp('completed_at'),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      index('checkout_sessions_customer_id_idx').on(table.customerId),
      index('checkout_sessions_status_expires_at_idx').on(table.status, table.expiresAt),
      index('checkout_sessions_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export const checkoutSessionLineItems = billingPgSchema.table(
  'checkout_session_line_items',
  {
    id: text('id').primaryKey(),
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
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [index('checkout_session_line_items_session_id_idx').on(table.checkoutSessionId)];
  },
);

export type CheckoutSession = typeof checkoutSessions.$inferSelect;
export type NewCheckoutSession = typeof checkoutSessions.$inferInsert;
export type CheckoutSessionLineItem = typeof checkoutSessionLineItems.$inferSelect;
export type NewCheckoutSessionLineItem = typeof checkoutSessionLineItems.$inferInsert;
