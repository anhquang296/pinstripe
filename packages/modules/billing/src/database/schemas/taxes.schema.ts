import type { TaxIdType, TaxIdVerificationStatus, TaxType } from '@contracts/taxes.types';
import { customers } from '@database/schemas/customers.schema';
import { billingPgSchema } from '@database/schemas/pg-schema.schema';
import { isoTimestamp } from '@vxrerp/platform/database';
import { sql } from 'drizzle-orm';
import { boolean, doublePrecision, index, jsonb, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const taxRates = billingPgSchema.table(
  'tax_rates',
  {
    id: text('id').primaryKey(),
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
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      index('tax_rates_created_at_id_idx').on(table.createdAt, table.id),
      index('tax_rates_country_state_idx').on(table.country, table.state),
    ];
  },
);

export const taxIds = billingPgSchema.table(
  'tax_ids',
  {
    id: text('id').primaryKey(),
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
    verificationAttemptedAt: isoTimestamp('verification_attempted_at'),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
    deletedAt: isoTimestamp('deleted_at'),
  },
  (table) => {
    return [
      index('tax_ids_customer_id_idx').on(table.customerId),
      index('tax_ids_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('tax_ids_customer_value_idx')
        .on(table.customerId, table.type, table.value)
        .where(sql`deleted_at is null`),
    ];
  },
);

export type TaxRate = typeof taxRates.$inferSelect;
export type NewTaxRate = typeof taxRates.$inferInsert;
export type TaxId = typeof taxIds.$inferSelect;
export type NewTaxId = typeof taxIds.$inferInsert;
