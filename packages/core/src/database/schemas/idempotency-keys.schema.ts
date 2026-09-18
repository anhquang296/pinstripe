import type { IdempotencyStatus } from '@contracts/idempotency.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, smallint, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    scope: text('scope').notNull(),
    route: text('route').notNull(),
    requestHash: text('request_hash').notNull(),
    status: text('status').$type<IdempotencyStatus>().notNull(),
    responseStatusCode: smallint('response_status_code'),
    responseBody: jsonb('response_body'),
    lockedAt: isoTimestamp('locked_at'),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
    expiresAt: isoTimestamp('expires_at').notNull(),
  },
  (table) => {
    return [
      uniqueIndex('idempotency_keys_scope_key_route_idx').on(table.scope, table.key, table.route),
      index('idempotency_keys_expires_at_idx').on(table.expiresAt),
    ];
  },
);

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;
