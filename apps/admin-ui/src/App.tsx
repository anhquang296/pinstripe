import AppLayout from '@components/AppLayout';
import CustomersPage from '@pages/CustomersPage';
import InvoicesPage from '@pages/InvoicesPage';
import LedgerPage from '@pages/LedgerPage';
import MetersPage from '@pages/MetersPage';
import PaymentsPage from '@pages/PaymentsPage';
import PricesPage from '@pages/PricesPage';
import ProductsPage from '@pages/ProductsPage';
import RatingPage from '@pages/RatingPage';
import SubscriptionsPage from '@pages/SubscriptionsPage';
import TestClocksPage from '@pages/TestClocksPage';
import { Navigate, Route, Routes } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/customers" replace />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/prices" element={<PricesPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/meters" element={<MetersPage />} />
        <Route path="/rating" element={<RatingPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/test-clocks" element={<TestClocksPage />} />
      </Route>
    </Routes>
  );
}
