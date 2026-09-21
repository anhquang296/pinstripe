import { billingPaths } from '@features/billing/routes/paths';
import type { InvoiceStatus } from '@vxrerp/billing/contracts';
import { InvoiceStatusEnum } from '@vxrerp/billing/contracts';
import { map } from 'lodash-es';
import { generatePath } from 'react-router-dom';

export const CATALOG_TABS = [
  { to: billingPaths.CATALOG_PRODUCTS, label: 'Products' },
  { to: billingPaths.CATALOG_PRICES, label: 'Prices' },
];

export const SUBSCRIPTION_TABS = [
  { to: billingPaths.SUBSCRIPTIONS_LIST, label: 'Subscriptions' },
  { to: billingPaths.SUBSCRIPTIONS_USAGE, label: 'Usage-based billing' },
  { to: billingPaths.SUBSCRIPTIONS_DISCOUNTS, label: 'Coupons & mã KM' },
  { to: billingPaths.SUBSCRIPTIONS_TAX, label: 'Thuế' },
];

export const CHECKOUT_TABS = [
  { to: billingPaths.CHECKOUT_PAYMENT_LINKS, label: 'Payment links' },
  { to: billingPaths.CHECKOUT_SESSIONS, label: 'Checkout sessions' },
  { to: billingPaths.CHECKOUT_PORTAL, label: 'Portal configurations' },
];

const INVOICE_STATUS_LABELS: { status: InvoiceStatus; label: string }[] = [
  { status: InvoiceStatusEnum.DRAFT, label: 'Draft' },
  { status: InvoiceStatusEnum.OPEN, label: 'Open' },
  { status: InvoiceStatusEnum.PAID, label: 'Paid' },
  { status: InvoiceStatusEnum.VOID, label: 'Void' },
  { status: InvoiceStatusEnum.UNCOLLECTIBLE, label: 'Uncollectible' },
];

export const INVOICE_STATUS_TABS: { to: string; label: string; status: InvoiceStatus }[] = map(
  INVOICE_STATUS_LABELS,
  ({ status, label }) => {
    return { to: generatePath(billingPaths.INVOICES_BY_STATUS, { status }), label, status };
  },
);

export const PAYMENT_TABS = [
  { to: billingPaths.PAYMENTS_INTENTS, label: 'Payment intents' },
  { to: billingPaths.PAYMENTS_REFUNDS, label: 'Refunds' },
];

export const LEDGER_TABS = [
  { to: billingPaths.LEDGER_ACCOUNTS, label: 'Accounts' },
  { to: billingPaths.LEDGER_TRANSACTIONS, label: 'Transactions' },
];
