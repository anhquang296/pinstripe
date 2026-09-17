import './index.css';

import AdminPinstripeProvider from '@lib/pinstripe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import App from './App';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const container = document.getElementById('root');

if (!container) {
  throw new Error('main() missing #root container in index.html');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AdminPinstripeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AdminPinstripeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
