export const dashboardPaths = {
  AUTH: '/auth/:path',
  OVERVIEW: '/',
  SETTINGS_ACCOUNT: '/settings/account',
  SETTINGS_SECURITY: '/settings/security',

  CUSTOMERS: '/customers',
  CUSTOMER: '/customers/:customerId',

  CATALOG: '/catalog',
  CATALOG_PRODUCTS: '/catalog/products',
  CATALOG_PRODUCT: '/catalog/products/:productId',
  CATALOG_PRICES: '/catalog/prices',
  CATALOG_PRICE: '/catalog/prices/:priceId',

  SUBSCRIPTIONS: '/subscriptions',
  SUBSCRIPTIONS_LIST: '/subscriptions/list',
  SUBSCRIPTION: '/subscriptions/list/:subscriptionId',
  SUBSCRIPTIONS_USAGE: '/subscriptions/usage',
  SUBSCRIPTIONS_METER: '/subscriptions/usage/:meterId',
  SUBSCRIPTIONS_DISCOUNTS: '/subscriptions/discounts',
  SUBSCRIPTIONS_COUPON: '/subscriptions/discounts/:couponId',
  SUBSCRIPTIONS_TAX: '/subscriptions/tax',
  SUBSCRIPTIONS_TAX_RATE: '/subscriptions/tax/:taxRateId',

  CHECKOUT: '/checkout',
  CHECKOUT_PAYMENT_LINKS: '/checkout/payment-links',
  CHECKOUT_PAYMENT_LINK: '/checkout/payment-links/:paymentLinkId',
  CHECKOUT_SESSIONS: '/checkout/sessions',
  CHECKOUT_SESSION: '/checkout/sessions/:checkoutSessionId',
  CHECKOUT_PORTAL: '/checkout/portal',
  CHECKOUT_PORTAL_CONFIGURATION: '/checkout/portal/:configurationId',

  INVOICES: '/invoices',
  INVOICES_DRAFT: '/invoices/draft',
  INVOICES_BY_STATUS: '/invoices/:status',
  INVOICE: '/invoices/:status/:invoiceId',

  PAYMENTS: '/payments',
  PAYMENTS_INTENTS: '/payments/intents',
  PAYMENTS_INTENT: '/payments/intents/:paymentIntentId',
  PAYMENTS_REFUNDS: '/payments/refunds',
  PAYMENTS_REFUND: '/payments/refunds/:refundId',

  LEDGER: '/ledger',
  LEDGER_ACCOUNTS: '/ledger/accounts',
  LEDGER_ACCOUNT: '/ledger/accounts/:accountId',
  LEDGER_TRANSACTIONS: '/ledger/transactions',
  LEDGER_TRANSACTION: '/ledger/transactions/:transactionId',

  REPORTS: '/reports',

  WEBHOOKS: '/webhooks',
  WEBHOOKS_ENDPOINTS: '/webhooks/endpoints',
  WEBHOOKS_ENDPOINT: '/webhooks/endpoints/:webhookEndpointId',
  WEBHOOKS_DELIVERIES: '/webhooks/deliveries',

  API_KEYS: '/api-keys',

  TEST_CLOCKS: '/test-clocks',
  TEST_CLOCK: '/test-clocks/:testClockId',

  ADMIN_USERS: '/admin/users',
  ADMIN_USER: '/admin/users/:userId',
  ADMIN_ROLES: '/admin/roles',
} as const;
