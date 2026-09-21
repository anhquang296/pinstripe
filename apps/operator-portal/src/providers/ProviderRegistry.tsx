'use client';

import { PortalVxrErpProvider } from '@providers/PortalVxrErpProvider';
import { QueryProvider } from '@providers/QueryProvider';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

interface ProviderRegistryProps {
  children: ReactNode;
}

export function ProviderRegistry({ children }: ProviderRegistryProps) {
  return (
    <QueryProvider>
      <PortalVxrErpProvider>
        {children}
        <Toaster position="top-right" richColors />
      </PortalVxrErpProvider>
    </QueryProvider>
  );
}
