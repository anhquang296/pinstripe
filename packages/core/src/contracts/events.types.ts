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
  CREDIT_NOTE = 'credit_note',
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
  SUBSCRIPTION_CANCELED = 'subscription.canceled',
  TEST_CLOCK_ADVANCED = 'test_clock.advanced',
  METER_CREATED = 'meter.created',
  INVOICE_CREATED = 'invoice.created',
  INVOICE_FINALIZED = 'invoice.finalized',
  INVOICE_PAID = 'invoice.paid',
  INVOICE_VOIDED = 'invoice.voided',
  INVOICE_MARKED_UNCOLLECTIBLE = 'invoice.marked_uncollectible',
  CREDIT_NOTE_CREATED = 'credit_note.created',
}
export type DomainEventType = `${DomainEventTypeEnum}`;
