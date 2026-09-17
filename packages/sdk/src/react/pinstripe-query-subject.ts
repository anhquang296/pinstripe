export enum PinstripeQuerySubjectEnum {
  CUSTOMER = 'customer',
  PRODUCT = 'product',
  PRICE = 'price',
  LEDGER = 'ledger',
  SUBSCRIPTION = 'subscription',
  TEST_CLOCK = 'test_clock',
  ENTITLEMENT = 'entitlement',
  METER = 'meter',
  INVOICE = 'invoice',
  CREDIT_NOTE = 'credit_note',
  PAYMENT = 'payment',
  REFUND = 'refund',
  WEBHOOK = 'webhook',
  REPORTING = 'reporting',
}

export type PinstripeQuerySubject = `${PinstripeQuerySubjectEnum}`;
