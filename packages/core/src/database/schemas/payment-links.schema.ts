import type { CheckoutSessionMode } from '@contracts/checkout.types';
import { prices } from '@database/schemas/prices.schema';
import type { Currency } from '@utils/currency';
import { bigint, boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const paymentLinks = pgTable(
  'payment_links',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    mode: text('mode').$type<CheckoutSessionMode>().notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    url: text('url').notNull(),
    successUrl: text('success_url').notNull(),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [index('payment_links_created_at_id_idx').on(table.createdAt, table.id)];
  },
);

export const paymentLinkLineItems = pgTable(
  'payment_link_line_items',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    paymentLinkId: text('payment_link_id')
      .notNull()
      .references(() => {
        return paymentLinks.id;
      }),
    priceId: text('price_id')
      .notNull()
      .references(() => {
        return prices.id;
      }),
    quantity: bigint('quantity', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [index('payment_link_line_items_payment_link_id_idx').on(table.paymentLinkId)];
  },
);

export type PaymentLink = typeof paymentLinks.$inferSelect;
export type NewPaymentLink = typeof paymentLinks.$inferInsert;
export type PaymentLinkLineItem = typeof paymentLinkLineItems.$inferSelect;
export type NewPaymentLinkLineItem = typeof paymentLinkLineItems.$inferInsert;
