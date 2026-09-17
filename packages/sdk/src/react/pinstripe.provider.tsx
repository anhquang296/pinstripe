import type { PinstripeClient } from '@client/pinstripe.client';
import type { PinstripeError } from '@errors/pinstripe.error';
import type { PinstripeQueries } from '@react/keys/create-pinstripe-queries';
import { createPinstripeQueries } from '@react/keys/create-pinstripe-queries';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

interface PinstripeContextValue {
  client: PinstripeClient;
  queries: PinstripeQueries;
  onMutationError: (error: PinstripeError) => void;
  onMutationSuccess: (message: string) => void;
}

interface PinstripeProviderProps {
  client: PinstripeClient;
  onMutationError?: (error: PinstripeError) => void;
  onMutationSuccess?: (message: string) => void;
  children: ReactNode;
}

const PinstripeContext = createContext<PinstripeContextValue | null>(null);

function noop() {
  return undefined;
}

export function PinstripeProvider({
  client,
  onMutationError = noop,
  onMutationSuccess = noop,
  children,
}: PinstripeProviderProps) {
  const value = useMemo(() => {
    return {
      client,
      queries: createPinstripeQueries(client),
      onMutationError,
      onMutationSuccess,
    };
  }, [client, onMutationError, onMutationSuccess]);

  return <PinstripeContext.Provider value={value}>{children}</PinstripeContext.Provider>;
}

export function usePinstripeContext(): PinstripeContextValue {
  const context = useContext(PinstripeContext);

  if (context) {
    return context;
  }

  throw new Error('usePinstripeContext() must be called inside a PinstripeProvider');
}

export function usePinstripeClient(): PinstripeClient {
  return usePinstripeContext().client;
}

export function usePinstripeQueries(): PinstripeQueries {
  return usePinstripeContext().queries;
}
