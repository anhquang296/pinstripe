import type { CouponDuration, DiscountLevel } from '@contracts/discounts.types';
import { customers } from '@database/schemas/customers.schema';
import type { Currency } from '@utils/currency';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const coupons = pgTable(
  'coupons',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    name: text('name').notNull().default(''),
    percentOff: doublePrecision('percent_off'),
    amountOff: bigint('amount_off', { mode: 'number' }),
    currency: text('currency').$type<Currency>(),
    duration: text('duration').$type<CouponDuration>().notNull(),
    durationInMonths: integer('duration_in_months'),
    maxRedemptions: integer('max_redemptions'),
    timesRedeemed: integer('times_redeemed').notNull().default(0),
    redeemBy: timestamp('redeem_by', { withTimezone: true }),
    appliesToProductIds: jsonb('applies_to_product_ids').$type<string[]>().notNull().default([]),
    valid: boolean('valid').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => {
    return [
      index('coupons_created_at_id_idx').on(table.createdAt, table.id),
      check(
        'coupons_exactly_one_discount_kind',
        sql`(percent_off is null) <> (amount_off is null)`,
      ),
      check('coupons_amount_off_needs_currency', sql`amount_off is null or currency is not null`),
    ];
  },
);

export const promotionCodes = pgTable(
  'promotion_codes',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    code: text('code').notNull(),
    couponId: text('coupon_id')
      .notNull()
      .references(() => {
        return coupons.id;
      }),
    customerId: text('customer_id').references(() => {
      return customers.id;
    }),
    active: boolean('active').notNull().default(true),
    maxRedemptions: integer('max_redemptions'),
    timesRedeemed: integer('times_redeemed').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    firstTimeTransaction: boolean('first_time_transaction').notNull().default(false),
    minimumAmount: bigint('minimum_amount', { mode: 'number' }),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('promotion_codes_coupon_id_idx').on(table.couponId),
      index('promotion_codes_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('promotion_codes_code_idx').on(table.livemode, table.code),
    ];
  },
);

export const discounts = pgTable(
  'discounts',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    couponId: text('coupon_id')
      .notNull()
      .references(() => {
        return coupons.id;
      }),
    promotionCodeId: text('promotion_code_id').references(() => {
      return promotionCodes.id;
    }),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    level: text('level').$type<DiscountLevel>().notNull(),
    subscriptionId: text('subscription_id'),
    subscriptionItemId: text('subscription_item_id'),
    invoiceId: text('invoice_id'),
    invoiceItemId: text('invoice_item_id'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => {
    return [
      index('discounts_customer_id_idx').on(table.customerId),
      index('discounts_subscription_id_idx').on(table.subscriptionId),
      index('discounts_invoice_id_idx').on(table.invoiceId),
      index('discounts_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
export type PromotionCode = typeof promotionCodes.$inferSelect;
export type NewPromotionCode = typeof promotionCodes.$inferInsert;
export type Discount = typeof discounts.$inferSelect;
export type NewDiscount = typeof discounts.$inferInsert;
