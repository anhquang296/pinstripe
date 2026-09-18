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
  DISCOUNT = 'discount',
  PAYMENT = 'payment',
  REFUND = 'refund',
  WEBHOOK = 'webhook',
  REPORTING = 'reporting',
  USER = 'user',
  ACCOUNT = 'account',
  API_KEY = 'api_key',
}

export type PinstripeQuerySubject = `${PinstripeQuerySubjectEnum}`;
