import type { PortalSessionStatus } from '@contracts/portal.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { customers } from '@database/schemas/customers.schema';
import { sql } from 'drizzle-orm';
import { index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const portalSessions = pgTable(
  'portal_sessions',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
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

export type PortalSession = typeof portalSessions.$inferSelect;
export type NewPortalSession = typeof portalSessions.$inferInsert;
