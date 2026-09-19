'use client';

import { PortalPinstripeProvider } from '@providers/PortalPinstripeProvider';
import { QueryProvider } from '@providers/QueryProvider';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

interface ProviderRegistryProps {
  children: ReactNode;
}

export function ProviderRegistry({ children }: ProviderRegistryProps) {
  return (
    <QueryProvider>
      <PortalPinstripeProvider>
        {children}
        <Toaster position="top-right" richColors />
      </PortalPinstripeProvider>
    </QueryProvider>
  );
}
