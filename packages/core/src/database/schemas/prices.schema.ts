import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  BillingScheme,
  Price as PriceContract,
  PriceType,
  RecurringInterval,
  TaxBehavior,
  TiersMode,
  UsageType,
} from '@contracts/prices.types';
import type { Currency } from '@utils/currency';
import { products } from '@database/schemas/products.schema';

export const prices = pgTable(
  'prices',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    lookupKey: text('lookup_key'),
    version: integer('version').notNull().default(1),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    active: boolean('active').notNull().default(true),
    nickname: text('nickname'),
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
  (table) => [
    index('prices_product_id_idx').on(table.productId),
    index('prices_created_at_id_idx').on(table.createdAt, table.id),
    uniqueIndex('prices_lookup_key_version_idx').on(table.lookupKey, table.version),
  ],
);

export type PriceEntity = typeof prices.$inferSelect;
export type NewPriceEntity = typeof prices.$inferInsert;
