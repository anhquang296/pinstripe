import type {
  CaptureMethod,
  ChargeOutcome,
  ChargeStatus,
  DeclineCode,
  FailureCode,
  NextAction,
  PaymentCancellationReason,
  PaymentIntentStatus,
  PaymentMethodDetails,
  PspEventType,
  PspProvider,
  RefundStatus,
} from '@contracts/payments.types';
import { CaptureMethodEnum } from '@contracts/payments.types';
import type { SetupIntentStatus, SetupIntentUsage } from '@contracts/setup-intents.types';
import { SetupIntentUsageEnum } from '@contracts/setup-intents.types';
import { isoTimestamp } from '@database/columns/iso-timestamp';
import { customers } from '@database/schemas/customers.schema';
import { invoices } from '@database/schemas/invoices.schema';
import { paymentMethods } from '@database/schemas/payment-methods.schema';
import type { Currency } from '@utils/currency';
import { sql } from 'drizzle-orm';
import { bigint, boolean, index, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const paymentIntents = pgTable(
  'payment_intents',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    invoiceId: text('invoice_id').references(() => {
      return invoices.id;
    }),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    status: text('status').$type<PaymentIntentStatus>().notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    amountCapturable: bigint('amount_capturable', { mode: 'number' }).notNull().default(0),
    amountReceived: bigint('amount_received', { mode: 'number' }).notNull().default(0),
    captureMethod: text('capture_method')
      .$type<CaptureMethod>()
      .notNull()
      .default(CaptureMethodEnum.AUTOMATIC),
    paymentMethodId: text('payment_method_id').references(() => {
      return paymentMethods.id;
    }),
    latestChargeId: text('latest_charge_id'),
    nextAction: jsonb('next_action').$type<NextAction>(),
    cancellationReason: text('cancellation_reason').$type<PaymentCancellationReason>(),
    pspReference: text('psp_reference'),
    failureCode: text('failure_code').$type<FailureCode>(),
    declineCode: text('decline_code').$type<DeclineCode>(),
    failureMessage: text('failure_message'),
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
      index('payment_intents_invoice_id_idx').on(table.invoiceId),
      index('payment_intents_customer_id_idx').on(table.customerId),
      index('payment_intents_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('payment_intents_psp_reference_idx').on(table.pspReference),
    ];
  },
);

export const charges = pgTable(
  'charges',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    paymentIntentId: text('payment_intent_id')
      .notNull()
      .references(() => {
        return paymentIntents.id;
      }),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    paymentMethodId: text('payment_method_id').references(() => {
      return paymentMethods.id;
    }),
    currency: text('currency').$type<Currency>().notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    amountCaptured: bigint('amount_captured', { mode: 'number' }).notNull().default(0),
    amountRefunded: bigint('amount_refunded', { mode: 'number' }).notNull().default(0),
    captured: boolean('captured').notNull().default(false),
    status: text('status').$type<ChargeStatus>().notNull(),
    outcome: text('outcome').$type<ChargeOutcome>().notNull(),
    balanceTransactionId: text('balance_transaction_id'),
    paymentMethodDetails: jsonb('payment_method_details')
      .$type<PaymentMethodDetails>()
      .notNull()
      .default({}),
    failureCode: text('failure_code').$type<FailureCode>(),
    declineCode: text('decline_code').$type<DeclineCode>(),
    failureMessage: text('failure_message'),
    pspReference: text('psp_reference'),
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
      index('charges_payment_intent_id_idx').on(table.paymentIntentId),
      index('charges_customer_id_idx').on(table.customerId),
      index('charges_created_at_id_idx').on(table.createdAt, table.id),
    ];
  },
);

export const setupIntents = pgTable(
  'setup_intents',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    status: text('status').$type<SetupIntentStatus>().notNull(),
    usage: text('usage')
      .$type<SetupIntentUsage>()
      .notNull()
      .default(SetupIntentUsageEnum.OFF_SESSION),
    paymentMethodId: text('payment_method_id').references(() => {
      return paymentMethods.id;
    }),
    nextAction: jsonb('next_action').$type<NextAction>(),
    cancellationReason: text('cancellation_reason').$type<PaymentCancellationReason>(),
    pspReference: text('psp_reference'),
    failureCode: text('failure_code').$type<FailureCode>(),
    failureMessage: text('failure_message'),
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
      index('setup_intents_customer_id_idx').on(table.customerId),
      index('setup_intents_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('setup_intents_psp_reference_idx').on(table.pspReference),
    ];
  },
);

export const pspEvents = pgTable(
  'psp_events',
  {
    id: text('id').primaryKey(),
    provider: text('provider').$type<PspProvider>().notNull(),
    eventId: text('event_id').notNull(),
    type: text('type').$type<PspEventType>().notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    receivedAt: isoTimestamp('received_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      uniqueIndex('psp_events_provider_event_id_idx').on(table.provider, table.eventId),
      index('psp_events_received_at_id_idx').on(table.receivedAt, table.id),
    ];
  },
);

export const refunds = pgTable(
  'refunds',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    paymentIntentId: text('payment_intent_id')
      .notNull()
      .references(() => {
        return paymentIntents.id;
      }),
    chargeId: text('charge_id')
      .notNull()
      .references(() => {
        return charges.id;
      }),
    invoiceId: text('invoice_id').references(() => {
      return invoices.id;
    }),
    creditNoteId: text('credit_note_id'),
    customerId: text('customer_id')
      .notNull()
      .references(() => {
        return customers.id;
      }),
    currency: text('currency').$type<Currency>().notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    reason: text('reason').notNull(),
    pspReference: text('psp_reference').notNull(),
    metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      index('refunds_invoice_id_idx').on(table.invoiceId),
      index('refunds_payment_intent_id_idx').on(table.paymentIntentId),
      index('refunds_charge_id_idx').on(table.chargeId),
      index('refunds_created_at_id_idx').on(table.createdAt, table.id),
      uniqueIndex('refunds_psp_reference_idx').on(table.pspReference),
    ];
  },
);

export const refundTransitions = pgTable(
  'refund_transitions',
  {
    id: text('id').primaryKey(),
    livemode: boolean('livemode').notNull(),
    refundId: text('refund_id')
      .notNull()
      .references(() => {
        return refunds.id;
      }),
    status: text('status').$type<RefundStatus>().notNull(),
    failureReason: text('failure_reason'),
    occurredAt: isoTimestamp('occurred_at').notNull(),
    createdAt: isoTimestamp('created_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => {
    return [
      index('refund_transitions_refund_id_idx').on(table.refundId),
      index('refund_transitions_occurred_at_id_idx').on(table.occurredAt, table.id),
    ];
  },
);

export type PaymentIntent = typeof paymentIntents.$inferSelect;
export type NewPaymentIntent = typeof paymentIntents.$inferInsert;
export type Charge = typeof charges.$inferSelect;
export type NewCharge = typeof charges.$inferInsert;
export type SetupIntent = typeof setupIntents.$inferSelect;
export type NewSetupIntent = typeof setupIntents.$inferInsert;
export type PspEvent = typeof pspEvents.$inferSelect;
export type NewPspEvent = typeof pspEvents.$inferInsert;
export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;
export type RefundTransition = typeof refundTransitions.$inferSelect;
export type NewRefundTransition = typeof refundTransitions.$inferInsert;
