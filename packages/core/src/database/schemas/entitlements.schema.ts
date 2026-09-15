import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { EntitlementStatus } from '@contracts/entitlements.types';
import { customers } from '@database/schemas/customers.schema';
import { products } from '@database/schemas/products.schema';
import { subscriptions } from '@database/schemas/subscriptions.schema';

export const entitlements = pgTable(
  'entitlements',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => subscriptions.id),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    status: text('status').$type<EntitlementStatus>().notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('entitlements_subscription_id_product_id_idx').on(
      table.subscriptionId,
      table.productId,
    ),
    index('entitlements_customer_id_idx').on(table.customerId),
    index('entitlements_created_at_id_idx').on(table.createdAt, table.id),
  ],
);

export type EntitlementEntity = typeof entitlements.$inferSelect;
export type NewEntitlementEntity = typeof entitlements.$inferInsert;
