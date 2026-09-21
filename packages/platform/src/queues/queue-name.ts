export enum QueueNameEnum {
  OUTBOX = 'OutboxQueue',
  DOMAIN_EVENT = 'DomainEventQueue',
  LEDGER = 'LedgerQueue',
  BILLING = 'BillingQueue',
  CHECKOUT = 'CheckoutQueue',
  PAYMENT = 'PaymentQueue',
  PAYOUT = 'PayoutQueue',
  WEBHOOK = 'WebhookQueue',
  DUNNING = 'DunningQueue',
  TAX = 'TaxQueue',
  NOTIFICATION = 'NotificationQueue',
}
export type QueueName = `${QueueNameEnum}`;

export enum WorkflowNameEnum {
  OUTBOX = 'outbox',
  DOMAIN_EVENT = 'domain-event',
  LEDGER = 'ledger',
  BILLING = 'billing',
  CHECKOUT = 'checkout',
  PAYMENT = 'payment',
  PAYOUT = 'payout',
  WEBHOOK = 'webhook',
  DUNNING = 'dunning',
  TAX = 'tax',
  NOTIFICATION = 'notification',
}
export type WorkflowName = `${WorkflowNameEnum}`;
