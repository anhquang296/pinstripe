export enum AggregateTypeEnum {
  CUSTOMER = 'customer',
  PRODUCT = 'product',
  PRICE = 'price',
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
}
export type DomainEventType = `${DomainEventTypeEnum}`;
