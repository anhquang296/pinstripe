import CheckoutSessionsPage from '@features/billing/views/pages/CheckoutSessionsPage';
import CustomersPage from '@features/billing/views/pages/CustomersPage';
import DiscountsPage from '@features/billing/views/pages/DiscountsPage';
import InvoicesPage from '@features/billing/views/pages/InvoicesPage';
import LedgerAccountsPage from '@features/billing/views/pages/LedgerAccountsPage';
import LedgerTransactionsPage from '@features/billing/views/pages/LedgerTransactionsPage';
import MetersPage from '@features/billing/views/pages/MetersPage';
import OverviewPage from '@features/billing/views/pages/OverviewPage';
import PaymentIntentsPage from '@features/billing/views/pages/PaymentIntentsPage';
import PaymentLinksPage from '@features/billing/views/pages/PaymentLinksPage';
import PortalConfigurationsPage from '@features/billing/views/pages/PortalConfigurationsPage';
import PricesPage from '@features/billing/views/pages/PricesPage';
import ProductsPage from '@features/billing/views/pages/ProductsPage';
import RefundsPage from '@features/billing/views/pages/RefundsPage';
import ReportsPage from '@features/billing/views/pages/ReportsPage';
import SubscriptionsPage from '@features/billing/views/pages/SubscriptionsPage';
import TaxRatesPage from '@features/billing/views/pages/TaxRatesPage';
import TestClocksPage from '@features/billing/views/pages/TestClocksPage';
import { Navigate, type RouteObject } from 'react-router-dom';

import { billingPaths } from './paths';

export const billingRouteDefs: RouteObject[] = [
  { index: true, element: <OverviewPage /> },

  { path: billingPaths.CUSTOMERS, element: <CustomersPage /> },
  { path: billingPaths.CUSTOMER, element: <CustomersPage /> },

  {
    path: billingPaths.CATALOG,
    element: <Navigate to={billingPaths.CATALOG_PRODUCTS} replace />,
  },
  { path: billingPaths.CATALOG_PRODUCTS, element: <ProductsPage /> },
  { path: billingPaths.CATALOG_PRODUCT, element: <ProductsPage /> },
  { path: billingPaths.CATALOG_PRICES, element: <PricesPage /> },
  { path: billingPaths.CATALOG_PRICE, element: <PricesPage /> },

  {
    path: billingPaths.SUBSCRIPTIONS,
    element: <Navigate to={billingPaths.SUBSCRIPTIONS_LIST} replace />,
  },
  { path: billingPaths.SUBSCRIPTIONS_LIST, element: <SubscriptionsPage /> },
  { path: billingPaths.SUBSCRIPTION, element: <SubscriptionsPage /> },
  { path: billingPaths.SUBSCRIPTIONS_USAGE, element: <MetersPage /> },
  { path: billingPaths.SUBSCRIPTIONS_METER, element: <MetersPage /> },
  { path: billingPaths.SUBSCRIPTIONS_DISCOUNTS, element: <DiscountsPage /> },
  { path: billingPaths.SUBSCRIPTIONS_COUPON, element: <DiscountsPage /> },
  { path: billingPaths.SUBSCRIPTIONS_TAX, element: <TaxRatesPage /> },
  { path: billingPaths.SUBSCRIPTIONS_TAX_RATE, element: <TaxRatesPage /> },

  {
    path: billingPaths.CHECKOUT,
    element: <Navigate to={billingPaths.CHECKOUT_PAYMENT_LINKS} replace />,
  },
  { path: billingPaths.CHECKOUT_PAYMENT_LINKS, element: <PaymentLinksPage /> },
  { path: billingPaths.CHECKOUT_PAYMENT_LINK, element: <PaymentLinksPage /> },
  { path: billingPaths.CHECKOUT_SESSIONS, element: <CheckoutSessionsPage /> },
  { path: billingPaths.CHECKOUT_SESSION, element: <CheckoutSessionsPage /> },
  { path: billingPaths.CHECKOUT_PORTAL, element: <PortalConfigurationsPage /> },
  {
    path: billingPaths.CHECKOUT_PORTAL_CONFIGURATION,
    element: <PortalConfigurationsPage />,
  },

  {
    path: billingPaths.INVOICES,
    element: <Navigate to={billingPaths.INVOICES_DRAFT} replace />,
  },
  { path: billingPaths.INVOICES_BY_STATUS, element: <InvoicesPage /> },
  { path: billingPaths.INVOICE, element: <InvoicesPage /> },

  {
    path: billingPaths.PAYMENTS,
    element: <Navigate to={billingPaths.PAYMENTS_INTENTS} replace />,
  },
  { path: billingPaths.PAYMENTS_INTENTS, element: <PaymentIntentsPage /> },
  { path: billingPaths.PAYMENTS_INTENT, element: <PaymentIntentsPage /> },
  { path: billingPaths.PAYMENTS_REFUNDS, element: <RefundsPage /> },
  { path: billingPaths.PAYMENTS_REFUND, element: <RefundsPage /> },

  {
    path: billingPaths.LEDGER,
    element: <Navigate to={billingPaths.LEDGER_ACCOUNTS} replace />,
  },
  { path: billingPaths.LEDGER_ACCOUNTS, element: <LedgerAccountsPage /> },
  { path: billingPaths.LEDGER_ACCOUNT, element: <LedgerAccountsPage /> },
  { path: billingPaths.LEDGER_TRANSACTIONS, element: <LedgerTransactionsPage /> },
  { path: billingPaths.LEDGER_TRANSACTION, element: <LedgerTransactionsPage /> },

  { path: billingPaths.REPORTS, element: <ReportsPage /> },

  { path: billingPaths.TEST_CLOCKS, element: <TestClocksPage /> },
  { path: billingPaths.TEST_CLOCK, element: <TestClocksPage /> },
];
