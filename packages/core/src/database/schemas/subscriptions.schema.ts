import type {
  BillingMode,
  CancellationReason,
  CollectionMethod,
  PauseCollectionBehavior,
  SubscriptionStatus,
  TrialEndBehavior,
} from '@contracts/subscriptions.types';
import { BillingModeEnum, TrialEndBehaviorEnum } from '@contracts/subscriptions.types';
import { customers } from '@database/schemas/customers.schema';
import { paymentMethods } from '@database/schemas/payment-methods.schema';
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
    billingMode: text('billing_mode')
      .$type<BillingMode>()
      .notNull()
      .default(BillingModeEnum.ADVANCE),
    billingCycleAnchor: timestamp('billing_cycle_anchor', { withTimezone: true }).notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    chargedThroughDate: timestamp('charged_through_date', { withTimezone: true }),
    trialStart: timestamp('trial_start', { withTimezone: true }),
    trialEnd: timestamp('trial_end', { withTimezone: true }),
    trialEndBehaviorMissingPaymentMethod: text('trial_end_behavior_missing_payment_method')
      .$type<TrialEndBehavior>()
      .notNull()
      .default(TrialEndBehaviorEnum.CREATE_INVOICE),
    defaultTaxRates: jsonb('default_tax_rates').$type<string[]>().notNull().default([]),
    defaultPaymentMethodId: text('default_payment_method_id').references(() => {
      return paymentMethods.id;
    }),
    pauseCollectionBehavior: text('pause_collection_behavior').$type<PauseCollectionBehavior>(),
    pauseCollectionResumesAt: timestamp('pause_collection_resumes_at', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    cancelAt: timestamp('cancel_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason').$type<CancellationReason>(),
    cancellationComment: text('cancellation_comment'),
    cancellationFeedback: text('cancellation_feedback'),
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
      index('subscriptions_status_updated_at_idx').on(table.status, table.updatedAt),
      index('subscriptions_cancel_at_idx').on(table.cancelAt),
      index('subscriptions_pause_collection_resumes_at_idx').on(table.pauseCollectionResumesAt),
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
  },
  (table) => {
    return [index('subscription_items_subscription_id_idx').on(table.subscriptionId)];
  },
);

export const subscriptionItemChanges = pgTable(
  'subscription_item_changes',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => {
        return subscriptions.id;
      }),
    subscriptionItemId: text('subscription_item_id')
      .notNull()
      .references(() => {
        return subscriptionItems.id;
      }),
    priceId: text('price_id')
      .notNull()
      .references(() => {
        return prices.id;
      }),
    quantity: integer('quantity').notNull().default(1),
    billedFrom: timestamp('billed_from', { withTimezone: true }).notNull(),
    billedThrough: timestamp('billed_through', { withTimezone: true }),
    invoicedThrough: timestamp('invoiced_through', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('subscription_item_changes_subscription_id_idx').on(table.subscriptionId),
      index('subscription_item_changes_subscription_item_id_idx').on(table.subscriptionItemId),
      index('subscription_item_changes_billed_from_idx').on(table.subscriptionId, table.billedFrom),
    ];
  },
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type SubscriptionItem = typeof subscriptionItems.$inferSelect;
export type NewSubscriptionItem = typeof subscriptionItems.$inferInsert;
export type SubscriptionItemChange = typeof subscriptionItemChanges.$inferSelect;
export type NewSubscriptionItemChange = typeof subscriptionItemChanges.$inferInsert;
