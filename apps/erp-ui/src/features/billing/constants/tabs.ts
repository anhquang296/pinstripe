import type { InvoiceStatus } from '@vxrerp/billing/contracts';
import { InvoiceStatusEnum } from '@vxrerp/billing/contracts';

export const CATALOG_TABS = [
  { to: '/catalog/products', label: 'Products' },
  { to: '/catalog/prices', label: 'Prices' },
];

export const SUBSCRIPTION_TABS = [
  { to: '/subscriptions/list', label: 'Subscriptions' },
  { to: '/subscriptions/usage', label: 'Usage-based billing' },
  { to: '/subscriptions/discounts', label: 'Coupons & mã KM' },
  { to: '/subscriptions/tax', label: 'Thuế' },
];

export const CHECKOUT_TABS = [
  { to: '/checkout/payment-links', label: 'Payment links' },
  { to: '/checkout/sessions', label: 'Checkout sessions' },
  { to: '/checkout/portal', label: 'Portal configurations' },
];

export const INVOICE_STATUS_TABS: { to: string; label: string; status: InvoiceStatus }[] = [
  { to: '/invoices/draft', label: 'Draft', status: InvoiceStatusEnum.DRAFT },
  { to: '/invoices/open', label: 'Open', status: InvoiceStatusEnum.OPEN },
  { to: '/invoices/paid', label: 'Paid', status: InvoiceStatusEnum.PAID },
  { to: '/invoices/void', label: 'Void', status: InvoiceStatusEnum.VOID },
  {
    to: '/invoices/uncollectible',
    label: 'Uncollectible',
    status: InvoiceStatusEnum.UNCOLLECTIBLE,
  },
];

export const PAYMENT_TABS = [
  { to: '/payments/intents', label: 'Payment intents' },
  { to: '/payments/refunds', label: 'Refunds' },
];

export const LEDGER_TABS = [
  { to: '/ledger/accounts', label: 'Accounts' },
  { to: '/ledger/transactions', label: 'Transactions' },
];
