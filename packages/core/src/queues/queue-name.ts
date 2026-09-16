export enum QueueNameEnum {
  OUTBOX = 'OutboxQueue',
  DOMAIN_EVENT = 'DomainEventQueue',
  LEDGER = 'LedgerQueue',
  BILLING = 'BillingQueue',
  PAYMENT = 'PaymentQueue',
  WEBHOOK = 'WebhookQueue',
  DUNNING = 'DunningQueue',
  NOTIFICATION = 'NotificationQueue',
}
export type QueueName = `${QueueNameEnum}`;

export enum WorkflowNameEnum {
  OUTBOX = 'outbox',
  DOMAIN_EVENT = 'domain-event',
  LEDGER = 'ledger',
  BILLING = 'billing',
  PAYMENT = 'payment',
  WEBHOOK = 'webhook',
  DUNNING = 'dunning',
  NOTIFICATION = 'notification',
}
export type WorkflowName = `${WorkflowNameEnum}`;
