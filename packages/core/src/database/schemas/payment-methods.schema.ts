import type {
  BillingDetails,
  PaymentMethodCard,
  PaymentMethodType,
} from '@contracts/payment-methods.types';
import { customers } from '@database/schemas/customers.schema';
import { boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    customerId: text('customer_id').references(() => {
      return customers.id;
    }),
    type: text('type').$type<PaymentMethodType>().notNull(),
    card: jsonb('card').$type<PaymentMethodCard>(),
    billingDetails: jsonb('billing_details').$type<BillingDetails>().notNull().default({}),
    pspToken: text('psp_token').notNull(),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    detachedAt: timestamp('detached_at', { withTimezone: true }),
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
