import RequireSession from '@features/dashboard/components/RequireSession';
import AppLayout from '@features/dashboard/views/layouts/AppLayout';
import AccountSettingsPage from '@features/dashboard/views/pages/AccountSettingsPage';
import ApiKeysPage from '@features/dashboard/views/pages/ApiKeysPage';
import AuthPage from '@features/dashboard/views/pages/AuthPage';
import CheckoutSessionsPage from '@features/dashboard/views/pages/CheckoutSessionsPage';
import CustomersPage from '@features/dashboard/views/pages/CustomersPage';
import DiscountsPage from '@features/dashboard/views/pages/DiscountsPage';
import InvoicesPage from '@features/dashboard/views/pages/InvoicesPage';
import LedgerAccountsPage from '@features/dashboard/views/pages/LedgerAccountsPage';
import LedgerTransactionsPage from '@features/dashboard/views/pages/LedgerTransactionsPage';
import MetersPage from '@features/dashboard/views/pages/MetersPage';
import OverviewPage from '@features/dashboard/views/pages/OverviewPage';
import PaymentIntentsPage from '@features/dashboard/views/pages/PaymentIntentsPage';
import PaymentLinksPage from '@features/dashboard/views/pages/PaymentLinksPage';
import PortalConfigurationsPage from '@features/dashboard/views/pages/PortalConfigurationsPage';
import PricesPage from '@features/dashboard/views/pages/PricesPage';
import ProductsPage from '@features/dashboard/views/pages/ProductsPage';
import RefundsPage from '@features/dashboard/views/pages/RefundsPage';
import ReportsPage from '@features/dashboard/views/pages/ReportsPage';
import RolesPage from '@features/dashboard/views/pages/RolesPage';
import SecuritySettingsPage from '@features/dashboard/views/pages/SecuritySettingsPage';
import SubscriptionsPage from '@features/dashboard/views/pages/SubscriptionsPage';
import TaxRatesPage from '@features/dashboard/views/pages/TaxRatesPage';
import TestClocksPage from '@features/dashboard/views/pages/TestClocksPage';
import UsersPage from '@features/dashboard/views/pages/UsersPage';
import WebhookDeliveriesPage from '@features/dashboard/views/pages/WebhookDeliveriesPage';
import WebhookEndpointsPage from '@features/dashboard/views/pages/WebhookEndpointsPage';
import { Navigate, type RouteObject } from 'react-router-dom';

import { dashboardPaths } from './paths';

export const dashboardRouteDefs: RouteObject[] = [
  { path: dashboardPaths.AUTH, element: <AuthPage /> },
  {
    element: <RequireSession />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: dashboardPaths.SETTINGS_ACCOUNT, element: <AccountSettingsPage /> },
          { path: dashboardPaths.SETTINGS_SECURITY, element: <SecuritySettingsPage /> },

          { path: dashboardPaths.CUSTOMERS, element: <CustomersPage /> },
          { path: dashboardPaths.CUSTOMER, element: <CustomersPage /> },

          {
            path: dashboardPaths.CATALOG,
            element: <Navigate to={dashboardPaths.CATALOG_PRODUCTS} replace />,
          },
          { path: dashboardPaths.CATALOG_PRODUCTS, element: <ProductsPage /> },
          { path: dashboardPaths.CATALOG_PRODUCT, element: <ProductsPage /> },
          { path: dashboardPaths.CATALOG_PRICES, element: <PricesPage /> },
          { path: dashboardPaths.CATALOG_PRICE, element: <PricesPage /> },

          {
            path: dashboardPaths.SUBSCRIPTIONS,
            element: <Navigate to={dashboardPaths.SUBSCRIPTIONS_LIST} replace />,
          },
          { path: dashboardPaths.SUBSCRIPTIONS_LIST, element: <SubscriptionsPage /> },
          { path: dashboardPaths.SUBSCRIPTION, element: <SubscriptionsPage /> },
          { path: dashboardPaths.SUBSCRIPTIONS_USAGE, element: <MetersPage /> },
          { path: dashboardPaths.SUBSCRIPTIONS_METER, element: <MetersPage /> },
          { path: dashboardPaths.SUBSCRIPTIONS_DISCOUNTS, element: <DiscountsPage /> },
          { path: dashboardPaths.SUBSCRIPTIONS_COUPON, element: <DiscountsPage /> },
          { path: dashboardPaths.SUBSCRIPTIONS_TAX, element: <TaxRatesPage /> },
          { path: dashboardPaths.SUBSCRIPTIONS_TAX_RATE, element: <TaxRatesPage /> },

          {
            path: dashboardPaths.CHECKOUT,
            element: <Navigate to={dashboardPaths.CHECKOUT_PAYMENT_LINKS} replace />,
          },
          { path: dashboardPaths.CHECKOUT_PAYMENT_LINKS, element: <PaymentLinksPage /> },
          { path: dashboardPaths.CHECKOUT_PAYMENT_LINK, element: <PaymentLinksPage /> },
          { path: dashboardPaths.CHECKOUT_SESSIONS, element: <CheckoutSessionsPage /> },
          { path: dashboardPaths.CHECKOUT_SESSION, element: <CheckoutSessionsPage /> },
          { path: dashboardPaths.CHECKOUT_PORTAL, element: <PortalConfigurationsPage /> },
          {
            path: dashboardPaths.CHECKOUT_PORTAL_CONFIGURATION,
            element: <PortalConfigurationsPage />,
          },

          {
            path: dashboardPaths.INVOICES,
            element: <Navigate to={dashboardPaths.INVOICES_DRAFT} replace />,
          },
          { path: dashboardPaths.INVOICES_BY_STATUS, element: <InvoicesPage /> },
          { path: dashboardPaths.INVOICE, element: <InvoicesPage /> },

          {
            path: dashboardPaths.PAYMENTS,
            element: <Navigate to={dashboardPaths.PAYMENTS_INTENTS} replace />,
          },
          { path: dashboardPaths.PAYMENTS_INTENTS, element: <PaymentIntentsPage /> },
          { path: dashboardPaths.PAYMENTS_INTENT, element: <PaymentIntentsPage /> },
          { path: dashboardPaths.PAYMENTS_REFUNDS, element: <RefundsPage /> },
          { path: dashboardPaths.PAYMENTS_REFUND, element: <RefundsPage /> },

          {
            path: dashboardPaths.LEDGER,
            element: <Navigate to={dashboardPaths.LEDGER_ACCOUNTS} replace />,
          },
          { path: dashboardPaths.LEDGER_ACCOUNTS, element: <LedgerAccountsPage /> },
          { path: dashboardPaths.LEDGER_ACCOUNT, element: <LedgerAccountsPage /> },
          { path: dashboardPaths.LEDGER_TRANSACTIONS, element: <LedgerTransactionsPage /> },
          { path: dashboardPaths.LEDGER_TRANSACTION, element: <LedgerTransactionsPage /> },

          { path: dashboardPaths.REPORTS, element: <ReportsPage /> },

          {
            path: dashboardPaths.WEBHOOKS,
            element: <Navigate to={dashboardPaths.WEBHOOKS_ENDPOINTS} replace />,
          },
          { path: dashboardPaths.WEBHOOKS_ENDPOINTS, element: <WebhookEndpointsPage /> },
          { path: dashboardPaths.WEBHOOKS_ENDPOINT, element: <WebhookEndpointsPage /> },
          { path: dashboardPaths.WEBHOOKS_DELIVERIES, element: <WebhookDeliveriesPage /> },

          { path: dashboardPaths.API_KEYS, element: <ApiKeysPage /> },

          { path: dashboardPaths.TEST_CLOCKS, element: <TestClocksPage /> },
          { path: dashboardPaths.TEST_CLOCK, element: <TestClocksPage /> },

          { path: dashboardPaths.ADMIN_USERS, element: <UsersPage /> },
          { path: dashboardPaths.ADMIN_USER, element: <UsersPage /> },
          { path: dashboardPaths.ADMIN_ROLES, element: <RolesPage /> },
        ],
      },
    ],
  },
];
