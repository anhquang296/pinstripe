import type { DisputeEvidence, DisputeReason, DisputeStatus } from '@contracts/disputes.types';
import { customers } from '@database/schemas/customers.schema';
import { invoices } from '@database/schemas/invoices.schema';
import { charges, paymentIntents } from '@database/schemas/payments.schema';
import type { Currency } from '@utils/currency';
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const disputes = pgTable(
  'disputes',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    chargeId: text('charge_id')
      .notNull()
      .references(() => {
        return charges.id;
      }),
    paymentIntentId: text('payment_intent_id')
      .notNull()
      .references(() => {
        return paymentIntents.id;
      }),
    invoiceId: text('invoice_id').references(() => {
      return invoices.id;
    }),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    currency: text('currency').$type<Currency>().notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    status: text('status').$type<DisputeStatus>().notNull(),
    reason: text('reason').$type<DisputeReason>().notNull(),
    evidence: jsonb('evidence').$type<DisputeEvidence>().notNull().default({}),
    evidenceSubmittedAt: timestamp('evidence_submitted_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    pspReference: text('psp_reference').notNull(),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => {
    return [
      index('disputes_charge_id_idx').on(table.chargeId),
      index('disputes_customer_id_idx').on(table.customerId),
      index('disputes_status_idx').on(table.status),
      index('disputes_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('disputes_psp_reference_idx').on(table.pspReference),
    ];
  },
);

export type Dispute = typeof disputes.$inferSelect;
export type NewDispute = typeof disputes.$inferInsert;
