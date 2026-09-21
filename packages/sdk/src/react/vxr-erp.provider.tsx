import type { VxrErpClient } from '@client/vxr-erp.client';
import type { VxrErpError } from '@errors/vxr-erp.error';
import type { VxrErpQueries } from '@react/keys/create-vxr-erp-queries';
import { createVxrErpQueries } from '@react/keys/create-vxr-erp-queries';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

interface VxrErpContextValue {
  client: VxrErpClient;
  queries: VxrErpQueries;
  onMutationError: (error: VxrErpError) => void;
  onMutationSuccess: (message: string) => void;
}

interface VxrErpProviderProps {
  client: VxrErpClient;
  onMutationError?: (error: VxrErpError) => void;
  onMutationSuccess?: (message: string) => void;
  children: ReactNode;
}

const VxrErpContext = createContext<VxrErpContextValue | null>(null);

function noop() {
  return undefined;
}

export function VxrErpProvider({
  client,
  onMutationError = noop,
  onMutationSuccess = noop,
  children,
}: VxrErpProviderProps) {
  const value = useMemo(() => {
    return {
      client,
      queries: createVxrErpQueries(client),
      onMutationError,
      onMutationSuccess,
    };
  }, [client, onMutationError, onMutationSuccess]);

  return <VxrErpContext.Provider value={value}>{children}</VxrErpContext.Provider>;
}

export function useVxrErpContext(): VxrErpContextValue {
  const context = useContext(VxrErpContext);

  if (context) {
    return context;
  }

  throw new Error('useVxrErpContext() must be called inside a VxrErpProvider');
}

export function useVxrErpClient(): VxrErpClient {
  return useVxrErpContext().client;
}

export function useVxrErpQueries(): VxrErpQueries {
  return useVxrErpContext().queries;
}
