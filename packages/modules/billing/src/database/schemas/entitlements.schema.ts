import type { EntitlementStatus } from '@contracts/entitlements.types';
import { customers } from '@database/schemas/customers.schema';
import { billingPgSchema } from '@database/schemas/pg-schema.schema';
import { products } from '@database/schemas/products.schema';
import { subscriptions } from '@database/schemas/subscriptions.schema';
import { isoTimestamp } from '@vxrerp/platform/database';
import { sql } from 'drizzle-orm';
import { index, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const entitlements = billingPgSchema.table(
  'entitlements',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => {
        return subscriptions.id;
      }),
    productId: text('product_id')
      .notNull()
      .references(() => {
        return products.id;
      }),
    status: text('status').$type<EntitlementStatus>().notNull(),
    grantedAt: isoTimestamp('granted_at').notNull(),
    revokedAt: isoTimestamp('revoked_at'),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      uniqueIndex('entitlements_subscription_id_product_id_idx').on(
        table.subscriptionId,
        table.productId,
      ),
      index('entitlements_customer_id_idx').on(table.customerId),
      index('entitlements_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export type Entitlement = typeof entitlements.$inferSelect;
export type NewEntitlement = typeof entitlements.$inferInsert;
