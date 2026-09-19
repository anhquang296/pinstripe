import AppLayout from '@components/AppLayout';
import RequireSession from '@components/RequireSession';
import AccountSettingsPage from '@pages/AccountSettingsPage';
import AuthPage from '@pages/AuthPage';
import CheckoutSessionsPage from '@pages/CheckoutSessionsPage';
import CustomersPage from '@pages/CustomersPage';
import DiscountsPage from '@pages/DiscountsPage';
import InvoicesPage from '@pages/InvoicesPage';
import LedgerPage from '@pages/LedgerPage';
import MetersPage from '@pages/MetersPage';
import PaymentLinksPage from '@pages/PaymentLinksPage';
import PaymentsPage from '@pages/PaymentsPage';
import PortalConfigurationsPage from '@pages/PortalConfigurationsPage';
import PricesPage from '@pages/PricesPage';
import ProductsPage from '@pages/ProductsPage';
import ReportsPage from '@pages/ReportsPage';
import SecuritySettingsPage from '@pages/SecuritySettingsPage';
import SubscriptionsPage from '@pages/SubscriptionsPage';
import TaxRatesPage from '@pages/TaxRatesPage';
import TestClocksPage from '@pages/TestClocksPage';
import WebhooksPage from '@pages/WebhooksPage';
import { Navigate, Route, Routes } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/auth/:path" element={<AuthPage />} />

      <Route element={<RequireSession />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/customers" replace />} />
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

          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/webhooks" element={<WebhooksPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/test-clocks" element={<TestClocksPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
