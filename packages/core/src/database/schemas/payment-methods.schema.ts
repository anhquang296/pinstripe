import type {
  BillingDetails,
  PaymentMethodCard,
  PaymentMethodType,
} from '@contracts/payment-methods.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { customers } from '@database/schemas/customers.schema';
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id').references(() => {
      return customers.id;
    }),
    type: text('type').$type<PaymentMethodType>().notNull(),
    card: jsonb('card').$type<PaymentMethodCard>(),
    billingDetails: jsonb('billing_details').$type<BillingDetails>().notNull().default({}),
    pspToken: text('psp_token').notNull(),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
    updatedAt: isoTimestamp('updated_at')
      .notNull()
      .default(sql`now()`),
    detachedAt: isoTimestamp('detached_at'),
  },
  (table) => {
    return [
      index('payment_methods_customer_id_idx').on(table.customerId),
      index('payment_methods_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
