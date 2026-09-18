import type {
  BillingMode,
  CancellationReason,
  CollectionMethod,
  PauseCollectionBehavior,
  SubscriptionStatus,
  TrialEndBehavior,
} from '@contracts/subscriptions.types';
import { BillingModeEnum, TrialEndBehaviorEnum } from '@contracts/subscriptions.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { customers } from '@database/schemas/customers.schema';
import { paymentMethods } from '@database/schemas/payment-methods.schema';
import { prices } from '@database/schemas/prices.schema';
import { testClocks } from '@database/schemas/test-clocks.schema';
import type { Currency } from '@utils/currency';
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

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
    billingCycleAnchor: isoTimestamp('billing_cycle_anchor').notNull(),
    currentPeriodStart: isoTimestamp('current_period_start').notNull(),
    currentPeriodEnd: isoTimestamp('current_period_end').notNull(),
    chargedThroughDate: isoTimestamp('charged_through_date'),
    trialStart: isoTimestamp('trial_start'),
    trialEnd: isoTimestamp('trial_end'),
    trialEndBehaviorMissingPaymentMethod: text('trial_end_behavior_missing_payment_method')
      .$type<TrialEndBehavior>()
      .notNull()
      .default(TrialEndBehaviorEnum.CREATE_INVOICE),
    defaultTaxRates: jsonb('default_tax_rates').$type<string[]>().notNull().default([]),
    defaultPaymentMethodId: text('default_payment_method_id').references(() => {
      return paymentMethods.id;
    }),
    pauseCollectionBehavior: text('pause_collection_behavior').$type<PauseCollectionBehavior>(),
    pauseCollectionResumesAt: isoTimestamp('pause_collection_resumes_at'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    cancelAt: isoTimestamp('cancel_at'),
    cancellationReason: text('cancellation_reason').$type<CancellationReason>(),
    cancellationComment: text('cancellation_comment'),
    cancellationFeedback: text('cancellation_feedback'),
    canceledAt: isoTimestamp('canceled_at'),
    endedAt: isoTimestamp('ended_at'),
    testClockId: text('test_clock_id').references(() => {
      return testClocks.id;
    }),
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
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    deletedAt: isoTimestamp('deleted_at'),
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
    billedFrom: isoTimestamp('billed_from').notNull(),
    billedThrough: isoTimestamp('billed_through'),
    invoicedThrough: isoTimestamp('invoiced_through'),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
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
