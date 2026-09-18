import type { BillingPortalFeatures } from '@contracts/billing-portal.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { customers } from '@database/schemas/customers.schema';
import { portalSessions } from '@database/schemas/portal.schema';
import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const billingPortalConfigurations = pgTable(
  'billing_portal_configurations',
  {
    id: text('id').primaryKey(),
    isActive: boolean('is_active').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    businessName: text('business_name').notNull(),
    defaultReturnUrl: text('default_return_url'),
    features: jsonb('features').$type<BillingPortalFeatures>().notNull(),
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
      uniqueIndex('billing_portal_configurations_default_idx')
        .on(table.isDefault)
        .where(sql`is_default`),
      index('billing_portal_configurations_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export const billingPortalSessions = pgTable(
  'billing_portal_sessions',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    configurationId: text('configuration_id')
      .notNull()
      .references(() => {
        return billingPortalConfigurations.id;
      }),
    portalSessionId: text('portal_session_id')
      .notNull()
      .references(() => {
        return portalSessions.id;
      }),
    url: text('url').notNull(),
    returnUrl: text('return_url'),
    expiresAt: isoTimestamp('expires_at').notNull(),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      index('billing_portal_sessions_customer_id_idx').on(table.customerId),
      index('billing_portal_sessions_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export type BillingPortalConfiguration = typeof billingPortalConfigurations.$inferSelect;
export type NewBillingPortalConfiguration = typeof billingPortalConfigurations.$inferInsert;
export type BillingPortalSession = typeof billingPortalSessions.$inferSelect;
export type NewBillingPortalSession = typeof billingPortalSessions.$inferInsert;
