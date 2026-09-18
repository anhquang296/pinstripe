import type { WebhookDeliveryStatus, WebhookEndpointStatus } from '@contracts/webhooks.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    url: text('url').notNull(),
    status: text('status').$type<WebhookEndpointStatus>().notNull(),
    enabledEvents: jsonb('enabled_events').$type<string[]>().notNull().default([]),
    description: text('description').notNull().default(''),
    secret: text('secret').notNull(),
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
      index('webhook_endpoints_status_idx').on(table.status),
      index('webhook_endpoints_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    endpointId: text('endpoint_id')
      .notNull()
      .references(() => {
        return webhookEndpoints.id;
      }),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    status: text('status').$type<WebhookDeliveryStatus>().notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    responseStatus: integer('response_status'),
    lastError: text('last_error'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    deliveredAt: isoTimestamp('delivered_at'),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      index('webhook_deliveries_endpoint_id_idx').on(table.endpointId),
      index('webhook_deliveries_status_idx').on(table.status),
      index('webhook_deliveries_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
