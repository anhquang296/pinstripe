import type { ApiKeyScope, ApiKeyType } from '@contracts/api-keys.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const apiKeys = pgTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').$type<ApiKeyType>().notNull(),
    scopes: jsonb('scopes').$type<ApiKeyScope[]>().notNull().default([]),
    livemode: boolean('livemode').notNull(),
    tokenPrefix: text('token_prefix').notNull(),
    tokenHash: text('token_hash').notNull(),
    lastUsedAt: isoTimestamp('last_used_at'),
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
      uniqueIndex('api_keys_token_hash_idx').on(table.tokenHash),
      index('api_keys_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
