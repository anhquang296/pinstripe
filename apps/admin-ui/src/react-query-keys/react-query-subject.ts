export enum ReactQuerySubjectEnum {
  CUSTOMER = 'customer',
  PRODUCT = 'product',
  PRICE = 'price',
  LEDGER = 'ledger',
  SUBSCRIPTION = 'subscription',
  TEST_CLOCK = 'test_clock',
  ENTITLEMENT = 'entitlement',
  METER = 'meter',
  INVOICE = 'invoice',
  PAYMENT = 'payment',
}
export type ReactQuerySubject = `${ReactQuerySubjectEnum}`;
