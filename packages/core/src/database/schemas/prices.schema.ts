import type {
  BillingScheme,
  PriceResponse as PriceContract,
  PriceType,
  RecurringInterval,
  TaxBehavior,
  TiersMode,
  UsageType,
} from '@contracts/prices.types';
import { products } from '@database/schemas/products.schema';
import type { Currency } from '@utils/currency';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const prices = pgTable(
  'prices',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => {
        return products.id;
      }),
    lookupKey: text('lookup_key'),
    version: integer('version').notNull().default(1),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    active: boolean('active').notNull().default(true),
    nickname: text('nickname').notNull().default(''),
    currency: text('currency').$type<Currency>().notNull(),
    type: text('type').$type<PriceType>().notNull(),
    billingScheme: text('billing_scheme').$type<BillingScheme>().notNull(),
    unitAmount: bigint('unit_amount', { mode: 'number' }),
    taxBehavior: text('tax_behavior').$type<TaxBehavior>().notNull(),
    recurringInterval: text('recurring_interval').$type<RecurringInterval>(),
    recurringIntervalCount: integer('recurring_interval_count'),
    usageType: text('usage_type').$type<UsageType>(),
    tiersMode: text('tiers_mode').$type<TiersMode>(),
    tiers: jsonb('tiers').$type<NonNullable<PriceContract['tiers']>>(),
    transformQuantity:
      jsonb('transform_quantity').$type<NonNullable<PriceContract['transformQuantity']>>(),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('prices_product_id_idx').on(table.productId),
      index('prices_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('prices_lookup_key_version_idx').on(table.lookupKey, table.version),
      check(
        'prices_per_unit_shape',
        sql`billing_scheme <> 'per_unit' or (unit_amount is not null and tiers is null and tiers_mode is null)`,
      ),
      check(
        'prices_tiered_shape',
        sql`billing_scheme <> 'tiered' or (tiers is not null and tiers_mode is not null and unit_amount is null)`,
      ),
      check(
        'prices_recurring_shape',
        sql`type <> 'recurring' or (recurring_interval is not null and recurring_interval_count is not null and usage_type is not null)`,
      ),
      check(
        'prices_one_time_shape',
        sql`type <> 'one_time' or (recurring_interval is null and recurring_interval_count is null and usage_type is null)`,
      ),
    ];
  },
);

export type Price = typeof prices.$inferSelect;
export type NewPrice = typeof prices.$inferInsert;
