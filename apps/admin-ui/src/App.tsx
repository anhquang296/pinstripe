import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '@components/AppLayout';
import CustomersPage from '@pages/CustomersPage';
import LedgerPage from '@pages/LedgerPage';
import PricesPage from '@pages/PricesPage';
import ProductsPage from '@pages/ProductsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/customers" replace />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/prices" element={<PricesPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
      </Route>
    </Routes>
  );
}
