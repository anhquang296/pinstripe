import { index, jsonb, pgTable, smallint, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export enum IdempotencyStatusEnum {
  IN_PROGRESS = 'in_progress',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}
export type IdempotencyStatus = `${IdempotencyStatusEnum}`;

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
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('idempotency_keys_scope_key_route_idx').on(table.scope, table.key, table.route),
    index('idempotency_keys_expires_at_idx').on(table.expiresAt),
  ],
);

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;
