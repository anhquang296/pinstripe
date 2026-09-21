import type { ApiKeyType } from '@contracts/api-keys.types';
import type { Permission } from '@contracts/users.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { platformPgSchema } from '@database/schemas/pg-schema.schema';
import { sql } from 'drizzle-orm';
import { index, jsonb, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const apiKeys = platformPgSchema.table(
  'api_keys',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').$type<ApiKeyType>().notNull(),
    permissions: jsonb('permissions').$type<Permission[]>().notNull().default([]),
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
