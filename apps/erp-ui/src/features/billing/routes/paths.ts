const BILLING_PATH = '/billing';

export const billingPaths = {
  OVERVIEW: BILLING_PATH,

  CUSTOMERS: `${BILLING_PATH}/customers`,
  CUSTOMER: `${BILLING_PATH}/customers/:customerId`,

  CATALOG: `${BILLING_PATH}/catalog`,
  CATALOG_PRODUCTS: `${BILLING_PATH}/catalog/products`,
  CATALOG_PRODUCT: `${BILLING_PATH}/catalog/products/:productId`,
  CATALOG_PRICES: `${BILLING_PATH}/catalog/prices`,
  CATALOG_PRICE: `${BILLING_PATH}/catalog/prices/:priceId`,

  SUBSCRIPTIONS: `${BILLING_PATH}/subscriptions`,
  SUBSCRIPTIONS_LIST: `${BILLING_PATH}/subscriptions/list`,
  SUBSCRIPTION: `${BILLING_PATH}/subscriptions/list/:subscriptionId`,
  SUBSCRIPTIONS_USAGE: `${BILLING_PATH}/subscriptions/usage`,
  SUBSCRIPTIONS_METER: `${BILLING_PATH}/subscriptions/usage/:meterId`,
  SUBSCRIPTIONS_DISCOUNTS: `${BILLING_PATH}/subscriptions/discounts`,
  SUBSCRIPTIONS_COUPON: `${BILLING_PATH}/subscriptions/discounts/:couponId`,
  SUBSCRIPTIONS_TAX: `${BILLING_PATH}/subscriptions/tax`,
  SUBSCRIPTIONS_TAX_RATE: `${BILLING_PATH}/subscriptions/tax/:taxRateId`,

  CHECKOUT: `${BILLING_PATH}/checkout`,
  CHECKOUT_PAYMENT_LINKS: `${BILLING_PATH}/checkout/payment-links`,
  CHECKOUT_PAYMENT_LINK: `${BILLING_PATH}/checkout/payment-links/:paymentLinkId`,
  CHECKOUT_SESSIONS: `${BILLING_PATH}/checkout/sessions`,
  CHECKOUT_SESSION: `${BILLING_PATH}/checkout/sessions/:checkoutSessionId`,
  CHECKOUT_PORTAL: `${BILLING_PATH}/checkout/portal`,
  CHECKOUT_PORTAL_CONFIGURATION: `${BILLING_PATH}/checkout/portal/:configurationId`,

  INVOICES: `${BILLING_PATH}/invoices`,
  INVOICES_DRAFT: `${BILLING_PATH}/invoices/draft`,
  INVOICES_BY_STATUS: `${BILLING_PATH}/invoices/:status`,
  INVOICE: `${BILLING_PATH}/invoices/:status/:invoiceId`,

  PAYMENTS: `${BILLING_PATH}/payments`,
  PAYMENTS_INTENTS: `${BILLING_PATH}/payments/intents`,
  PAYMENTS_INTENT: `${BILLING_PATH}/payments/intents/:paymentIntentId`,
  PAYMENTS_REFUNDS: `${BILLING_PATH}/payments/refunds`,
  PAYMENTS_REFUND: `${BILLING_PATH}/payments/refunds/:refundId`,

  LEDGER: `${BILLING_PATH}/ledger`,
  LEDGER_ACCOUNTS: `${BILLING_PATH}/ledger/accounts`,
  LEDGER_ACCOUNT: `${BILLING_PATH}/ledger/accounts/:accountId`,
  LEDGER_TRANSACTIONS: `${BILLING_PATH}/ledger/transactions`,
  LEDGER_TRANSACTION: `${BILLING_PATH}/ledger/transactions/:transactionId`,

  REPORTS: `${BILLING_PATH}/reports`,

  TEST_CLOCKS: `${BILLING_PATH}/test-clocks`,
  TEST_CLOCK: `${BILLING_PATH}/test-clocks/:testClockId`,
} as const;
