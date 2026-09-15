export enum AggregateTypeEnum {
  CUSTOMER = 'customer',
  PRODUCT = 'product',
  PRICE = 'price',
  LEDGER_TRANSACTION = 'ledger_transaction',
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
}
export type DomainEventType = `${DomainEventTypeEnum}`;
