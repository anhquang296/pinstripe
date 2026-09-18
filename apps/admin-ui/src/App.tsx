import AppLayout from '@components/AppLayout';
import RequireSession from '@components/RequireSession';
import AccountSettingsPage from '@pages/AccountSettingsPage';
import AuthPage from '@pages/AuthPage';
import CustomersPage from '@pages/CustomersPage';
import DiscountsPage from '@pages/DiscountsPage';
import InvoicesPage from '@pages/InvoicesPage';
import LedgerPage from '@pages/LedgerPage';
import MetersPage from '@pages/MetersPage';
import PaymentsPage from '@pages/PaymentsPage';
import PricesPage from '@pages/PricesPage';
import ProductsPage from '@pages/ProductsPage';
import RatingPage from '@pages/RatingPage';
import ReportsPage from '@pages/ReportsPage';
import SecuritySettingsPage from '@pages/SecuritySettingsPage';
import SubscriptionsPage from '@pages/SubscriptionsPage';
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
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/prices" element={<PricesPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/meters" element={<MetersPage />} />
          <Route path="/rating" element={<RatingPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/discounts" element={<DiscountsPage />} />
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
