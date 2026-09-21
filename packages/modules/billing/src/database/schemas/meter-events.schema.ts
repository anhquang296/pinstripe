import { customers } from '@database/schemas/customers.schema';
import { meters } from '@database/schemas/meters.schema';
import { billingPgSchema } from '@database/schemas/pg-schema.schema';
import { isoTimestamp } from '@vxrerp/platform/database';
import { doublePrecision, index, jsonb, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const meterEvents = billingPgSchema.table(
  'meter_events',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    meterId: text('meter_id')
      .notNull()
      .references(() => {
        return meters.id;
      }),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    eventName: text('event_name').notNull(),
    value: doublePrecision('value').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    timestamp: isoTimestamp('timestamp').notNull(),
    receivedAt: isoTimestamp('received_at').notNull(),
  },
  (table) => {
    return [
      uniqueIndex('meter_events_meter_id_identifier_idx').on(table.meterId, table.identifier),
      index('meter_events_meter_id_customer_id_timestamp_idx').on(
        table.meterId,
        table.customerId,
        table.timestamp,
      ),
      index('meter_events_received_at_idx').on(table.receivedAt),
    ];
  },
);

export type MeterEvent = typeof meterEvents.$inferSelect;
export type NewMeterEvent = typeof meterEvents.$inferInsert;
