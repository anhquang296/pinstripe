import type { TaxIdType, TaxIdVerificationStatus, TaxType } from '@contracts/taxes.types';
import { customers } from '@database/schemas/customers.schema';
import { sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const taxRates = pgTable(
  'tax_rates',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    displayName: text('display_name').notNull(),
    description: text('description').notNull().default(''),
    percentage: doublePrecision('percentage').notNull(),
    inclusive: boolean('inclusive').notNull(),
    jurisdiction: text('jurisdiction').notNull().default(''),
    country: text('country'),
    state: text('state'),
    taxType: text('tax_type').$type<TaxType>().notNull(),
    active: boolean('active').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('tax_rates_created_at_id_idx').on(table.createdAt, table.id),
      index('tax_rates_country_state_idx').on(table.livemode, table.country, table.state),
    ];
  },
);

export const taxIds = pgTable(
  'tax_ids',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    type: text('type').$type<TaxIdType>().notNull(),
    value: text('value').notNull(),
    country: text('country'),
    verificationStatus: text('verification_status').$type<TaxIdVerificationStatus>().notNull(),
    verifiedName: text('verified_name'),
    verifiedAddress: text('verified_address'),
    verificationAttemptedAt: timestamp('verification_attempted_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => {
    return [
      index('tax_ids_customer_id_idx').on(table.customerId),
      index('tax_ids_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('tax_ids_customer_value_idx')
        .on(table.livemode, table.customerId, table.type, table.value)
        .where(sql`deleted_at is null`),
    ];
  },
);

export type TaxRate = typeof taxRates.$inferSelect;
export type NewTaxRate = typeof taxRates.$inferInsert;
export type TaxId = typeof taxIds.$inferSelect;
export type NewTaxId = typeof taxIds.$inferInsert;
