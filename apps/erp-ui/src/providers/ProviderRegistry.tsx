import { Toaster } from 'sonner';

import { AdminVxrErpProvider } from './AdminVxrErpProvider';
import { QueryProvider } from './QueryProvider';
import { RoutesProvider } from './RoutesProvider';

export function ProviderRegistry() {
  return (
    <QueryProvider>
      <AdminVxrErpProvider>
        <RoutesProvider />
        <Toaster position="top-right" richColors />
      </AdminVxrErpProvider>
    </QueryProvider>
  );
}
