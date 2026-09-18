import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export enum OutboxStatusEnum {
  PENDING = 'pending',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
}
export type OutboxStatus = `${OutboxStatusEnum}`;

export enum AggregateTypeEnum {
  CUSTOMER = 'customer',
  PRODUCT = 'product',
  PRICE = 'price',
  LEDGER_TRANSACTION = 'ledger_transaction',
  SUBSCRIPTION = 'subscription',
  TEST_CLOCK = 'test_clock',
  METER = 'meter',
  INVOICE = 'invoice',
  INVOICEITEM = 'invoiceitem',
  CREDIT_NOTE = 'credit_note',
  CUSTOMER_BALANCE_TRANSACTION = 'customer_balance_transaction',
  DISCOUNT = 'discount',
  PAYMENT_INTENT = 'payment_intent',
  REFUND = 'refund',
  PAYOUT = 'payout',
  DISPUTE = 'dispute',
  TAX_RATE = 'tax_rate',
  TAX_ID = 'tax_id',
}
export type AggregateType = `${AggregateTypeEnum}`;

export enum DomainEventTypeEnum {
  CUSTOMER_CREATED = 'customer.created',
  CUSTOMER_UPDATED = 'customer.updated',
  CUSTOMER_DELETED = 'customer.deleted',
  PRODUCT_CREATED = 'product.created',
  PRODUCT_UPDATED = 'product.updated',
  PRICE_CREATED = 'price.created',
  PRICE_UPDATED = 'price.updated',
  LEDGER_TRANSACTION_POSTED = 'ledger.transaction.posted',
  LEDGER_TRANSACTION_REVERSED = 'ledger.transaction.reversed',
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_TRIAL_ENDED = 'subscription.trial_ended',
  SUBSCRIPTION_RENEWED = 'subscription.renewed',
  SUBSCRIPTION_PAUSED = 'subscription.paused',
  SUBSCRIPTION_RESUMED = 'subscription.resumed',
  SUBSCRIPTION_INCOMPLETE_EXPIRED = 'subscription.incomplete_expired',
  SUBSCRIPTION_CANCELED = 'subscription.canceled',
  TEST_CLOCK_ADVANCED = 'test_clock.advanced',
  METER_CREATED = 'meter.created',
  INVOICE_CREATED = 'invoice.created',
  INVOICE_FINALIZED = 'invoice.finalized',
  INVOICE_PAID = 'invoice.paid',
  INVOICE_VOIDED = 'invoice.voided',
  INVOICE_MARKED_UNCOLLECTIBLE = 'invoice.marked_uncollectible',
  INVOICEITEM_CREATED = 'invoiceitem.created',
  INVOICEITEM_UPDATED = 'invoiceitem.updated',
  INVOICEITEM_DELETED = 'invoiceitem.deleted',
  CREDIT_NOTE_CREATED = 'credit_note.created',
  CUSTOMER_BALANCE_TRANSACTION_CREATED = 'customer_balance_transaction.created',
  CUSTOMER_DISCOUNT_CREATED = 'customer.discount.created',
  CUSTOMER_DISCOUNT_UPDATED = 'customer.discount.updated',
  CUSTOMER_DISCOUNT_DELETED = 'customer.discount.deleted',
  PAYMENT_INTENT_SUCCEEDED = 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED = 'payment_intent.failed',
  REFUND_CREATED = 'refund.created',
  REFUND_UPDATED = 'refund.updated',
  CREDIT_NOTE_VOIDED = 'credit_note.voided',
  PAYOUT_CREATED = 'payout.created',
  PAYOUT_PAID = 'payout.paid',
  PAYOUT_FAILED = 'payout.failed',
  DISPUTE_CREATED = 'dispute.created',
  DISPUTE_UPDATED = 'dispute.updated',
  DISPUTE_CLOSED = 'dispute.closed',
  TAX_RATE_CREATED = 'tax_rate.created',
  TAX_RATE_UPDATED = 'tax_rate.updated',
  TAX_ID_CREATED = 'tax_id.created',
  TAX_ID_UPDATED = 'tax_id.updated',
  TAX_ID_DELETED = 'tax_id.deleted',
}
export type DomainEventType = `${DomainEventTypeEnum}`;

export const eventSchema = Type.Object({
  object: Type.Literal('event'),
  id: Type.String(),
  livemode: Type.Boolean(),
  type: Type.Unsafe<DomainEventType>(Type.Enum(DomainEventTypeEnum)),
  apiVersion: Type.String(),
  data: Type.Object({ object: Type.Unknown() }),
  requestId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
});

export const eventParamsSchema = Type.Object({
  eventId: Type.String(),
});

export const findEventsSchema = Type.Object(
  {
    type: Type.Optional(Type.Unsafe<DomainEventType>(Type.Enum(DomainEventTypeEnum))),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    startingAfter: Type.Optional(Type.String()),
    endingBefore: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type EventResponse = Static<typeof eventSchema>;
export type FindEventsQuery = Static<typeof findEventsSchema>;
