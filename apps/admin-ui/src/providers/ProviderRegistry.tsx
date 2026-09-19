import { Toaster } from 'sonner';

import { AdminPinstripeProvider } from './AdminPinstripeProvider';
import { QueryProvider } from './QueryProvider';
import { RoutesProvider } from './RoutesProvider';

export function ProviderRegistry() {
  return (
    <QueryProvider>
      <AdminPinstripeProvider>
        <RoutesProvider />
        <Toaster position="top-right" richColors />
      </AdminPinstripeProvider>
    </QueryProvider>
  );
}
