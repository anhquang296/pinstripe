import AppLayout from '@components/AppLayout';
import RequireSession from '@components/RequireSession';
import AccountSettingsPage from '@pages/AccountSettingsPage';
import ApiKeysPage from '@pages/ApiKeysPage';
import AuthPage from '@pages/AuthPage';
import CheckoutSessionsPage from '@pages/CheckoutSessionsPage';
import CustomersPage from '@pages/CustomersPage';
import DiscountsPage from '@pages/DiscountsPage';
import InvoicesPage from '@pages/InvoicesPage';
import LedgerAccountsPage from '@pages/LedgerAccountsPage';
import LedgerTransactionsPage from '@pages/LedgerTransactionsPage';
import MetersPage from '@pages/MetersPage';
import OverviewPage from '@pages/OverviewPage';
import PaymentIntentsPage from '@pages/PaymentIntentsPage';
import PaymentLinksPage from '@pages/PaymentLinksPage';
import PortalConfigurationsPage from '@pages/PortalConfigurationsPage';
import PricesPage from '@pages/PricesPage';
import ProductsPage from '@pages/ProductsPage';
import RefundsPage from '@pages/RefundsPage';
import ReportsPage from '@pages/ReportsPage';
import RolesPage from '@pages/RolesPage';
import SecuritySettingsPage from '@pages/SecuritySettingsPage';
import SubscriptionsPage from '@pages/SubscriptionsPage';
import TaxRatesPage from '@pages/TaxRatesPage';
import TestClocksPage from '@pages/TestClocksPage';
import UsersPage from '@pages/UsersPage';
import WebhookDeliveriesPage from '@pages/WebhookDeliveriesPage';
import WebhookEndpointsPage from '@pages/WebhookEndpointsPage';
import { Navigate, Route, Routes } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/auth/:path" element={<AuthPage />} />

      <Route element={<RequireSession />}>
        <Route element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="/settings/account" element={<AccountSettingsPage />} />
          <Route path="/settings/security" element={<SecuritySettingsPage />} />

          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:customerId" element={<CustomersPage />} />

          <Route path="/catalog" element={<Navigate to="/catalog/products" replace />} />
          <Route path="/catalog/products" element={<ProductsPage />} />
          <Route path="/catalog/products/:productId" element={<ProductsPage />} />
          <Route path="/catalog/prices" element={<PricesPage />} />
          <Route path="/catalog/prices/:priceId" element={<PricesPage />} />

          <Route path="/subscriptions" element={<Navigate to="/subscriptions/list" replace />} />
          <Route path="/subscriptions/list" element={<SubscriptionsPage />} />
          <Route path="/subscriptions/list/:subscriptionId" element={<SubscriptionsPage />} />
          <Route path="/subscriptions/usage" element={<MetersPage />} />
          <Route path="/subscriptions/usage/:meterId" element={<MetersPage />} />
          <Route path="/subscriptions/discounts" element={<DiscountsPage />} />
          <Route path="/subscriptions/discounts/:couponId" element={<DiscountsPage />} />
          <Route path="/subscriptions/tax" element={<TaxRatesPage />} />
          <Route path="/subscriptions/tax/:taxRateId" element={<TaxRatesPage />} />

          <Route path="/checkout" element={<Navigate to="/checkout/payment-links" replace />} />
          <Route path="/checkout/payment-links" element={<PaymentLinksPage />} />
          <Route path="/checkout/payment-links/:paymentLinkId" element={<PaymentLinksPage />} />
          <Route path="/checkout/sessions" element={<CheckoutSessionsPage />} />
          <Route path="/checkout/sessions/:checkoutSessionId" element={<CheckoutSessionsPage />} />
          <Route path="/checkout/portal" element={<PortalConfigurationsPage />} />
          <Route path="/checkout/portal/:configurationId" element={<PortalConfigurationsPage />} />

          <Route path="/invoices" element={<Navigate to="/invoices/draft" replace />} />
          <Route path="/invoices/:status" element={<InvoicesPage />} />
          <Route path="/invoices/:status/:invoiceId" element={<InvoicesPage />} />

          <Route path="/payments" element={<Navigate to="/payments/intents" replace />} />
          <Route path="/payments/intents" element={<PaymentIntentsPage />} />
          <Route path="/payments/intents/:paymentIntentId" element={<PaymentIntentsPage />} />
          <Route path="/payments/refunds" element={<RefundsPage />} />
          <Route path="/payments/refunds/:refundId" element={<RefundsPage />} />

          <Route path="/ledger" element={<Navigate to="/ledger/accounts" replace />} />
          <Route path="/ledger/accounts" element={<LedgerAccountsPage />} />
          <Route path="/ledger/accounts/:accountId" element={<LedgerAccountsPage />} />
          <Route path="/ledger/transactions" element={<LedgerTransactionsPage />} />
          <Route path="/ledger/transactions/:transactionId" element={<LedgerTransactionsPage />} />

          <Route path="/reports" element={<ReportsPage />} />

          <Route path="/webhooks" element={<Navigate to="/webhooks/endpoints" replace />} />
          <Route path="/webhooks/endpoints" element={<WebhookEndpointsPage />} />
          <Route path="/webhooks/endpoints/:webhookEndpointId" element={<WebhookEndpointsPage />} />
          <Route path="/webhooks/deliveries" element={<WebhookDeliveriesPage />} />

          <Route path="/api-keys" element={<ApiKeysPage />} />

          <Route path="/test-clocks" element={<TestClocksPage />} />
          <Route path="/test-clocks/:testClockId" element={<TestClocksPage />} />

          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/users/:userId" element={<UsersPage />} />
          <Route path="/admin/roles" element={<RolesPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
