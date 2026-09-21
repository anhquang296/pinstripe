import type { PortalSessionStatus } from '@contracts/portal.types';
import type { PortalRole } from '@contracts/portal-memberships.types';
import { customers } from '@database/schemas/customers.schema';
import { billingPgSchema } from '@database/schemas/pg-schema.schema';
import { isoTimestamp } from '@vxrerp/platform/database';
import { sql } from 'drizzle-orm';
import { index, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const portalUsers = billingPgSchema.table(
  'portal_users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull().default(''),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [uniqueIndex('portal_users_email_idx').on(table.email)];
  },
);

export const portalMemberships = billingPgSchema.table(
  'portal_memberships',
  {
    id: text('id').primaryKey(),
    portalUserId: text('portal_user_id')
      .notNull()
      .references(() => {
        return portalUsers.id;
      }),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    role: text('role').$type<PortalRole>().notNull(),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      uniqueIndex('portal_memberships_portal_user_id_customer_id_idx').on(
        table.portalUserId,
        table.customerId,
      ),
      index('portal_memberships_customer_id_idx').on(table.customerId),
    ];
  },
);

export const portalSessions = billingPgSchema.table(
  'portal_sessions',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    portalUserId: text('portal_user_id').references(() => {
      return portalUsers.id;
    }),
    status: text('status').$type<PortalSessionStatus>().notNull(),
    linkTokenHash: text('link_token_hash').notNull(),
    sessionTokenHash: text('session_token_hash'),
    linkExpiresAt: isoTimestamp('link_expires_at').notNull(),
    sessionExpiresAt: isoTimestamp('session_expires_at'),
    redeemedAt: isoTimestamp('redeemed_at'),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      uniqueIndex('portal_sessions_link_token_hash_idx').on(table.linkTokenHash),
      uniqueIndex('portal_sessions_session_token_hash_idx')
        .on(table.sessionTokenHash)
        .where(sql`session_token_hash is not null`),
      index('portal_sessions_customer_id_idx').on(table.customerId),
      index('portal_sessions_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export type PortalUser = typeof portalUsers.$inferSelect;
export type NewPortalUser = typeof portalUsers.$inferInsert;
export type PortalMembership = typeof portalMemberships.$inferSelect;
export type NewPortalMembership = typeof portalMemberships.$inferInsert;
export type PortalSession = typeof portalSessions.$inferSelect;
export type NewPortalSession = typeof portalSessions.$inferInsert;
