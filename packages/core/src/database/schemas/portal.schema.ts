import type { PortalSessionStatus } from '@contracts/portal.types';
import { customers } from '@database/schemas/customers.schema';
import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const portalSessions = pgTable(
  'portal_sessions',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    status: text('status').$type<PortalSessionStatus>().notNull(),
    linkTokenHash: text('link_token_hash').notNull(),
    sessionTokenHash: text('session_token_hash'),
    linkExpiresAt: timestamp('link_expires_at', { withTimezone: true }).notNull(),
    sessionExpiresAt: timestamp('session_expires_at', { withTimezone: true }),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
