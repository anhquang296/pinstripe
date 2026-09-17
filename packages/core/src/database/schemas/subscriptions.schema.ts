import type { CollectionMethod, SubscriptionStatus } from '@contracts/subscriptions.types';
import { customers } from '@database/schemas/customers.schema';
import { prices } from '@database/schemas/prices.schema';
import { testClocks } from '@database/schemas/test-clocks.schema';
import type { Currency } from '@utils/currency';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    status: text('status').$type<SubscriptionStatus>().notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    collectionMethod: text('collection_method').$type<CollectionMethod>().notNull(),
    billingCycleAnchor: timestamp('billing_cycle_anchor', { withTimezone: true }).notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    chargedThroughDate: timestamp('charged_through_date', { withTimezone: true }),
    trialStart: timestamp('trial_start', { withTimezone: true }),
    trialEnd: timestamp('trial_end', { withTimezone: true }),
    defaultTaxRates: jsonb('default_tax_rates').$type<string[]>().notNull().default([]),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    testClockId: text('test_clock_id').references(() => {
      return testClocks.id;
    }),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('subscriptions_customer_id_idx').on(table.customerId),
      index('subscriptions_created_at_id_idx').on(table.createdAt, table.id),
      index('subscriptions_status_current_period_end_idx').on(table.status, table.currentPeriodEnd),
      index('subscriptions_test_clock_id_idx').on(table.testClockId),
      check(
        'subscriptions_test_clock_is_test_mode',
        sql`test_clock_id is null or livemode = false`,
      ),
    ];
  },
);

export const subscriptionItems = pgTable(
  'subscription_items',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => {
        return subscriptions.id;
      }),
    priceId: text('price_id')
      .notNull()
      .references(() => {
        return prices.id;
      }),
    quantity: integer('quantity').notNull().default(1),
    taxRates: jsonb('tax_rates').$type<string[]>().notNull().default([]),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    billedFrom: timestamp('billed_from', { withTimezone: true }).notNull().defaultNow(),
    billedThrough: timestamp('billed_through', { withTimezone: true }),
    invoicedThrough: timestamp('invoiced_through', { withTimezone: true }),
  },
  (table) => {
    return [index('subscription_items_subscription_id_idx').on(table.subscriptionId)];
  },
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type SubscriptionItem = typeof subscriptionItems.$inferSelect;
export type NewSubscriptionItem = typeof subscriptionItems.$inferInsert;
