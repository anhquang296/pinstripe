import { toast } from '@libs/toast';
import type { PinstripeError } from '@pinstripe/sdk';
import { PinstripeClient } from '@pinstripe/sdk';
import { PinstripeProvider } from '@pinstripe/sdk/react';
import type { ReactNode } from 'react';

interface AdminPinstripeProviderProps {
  children: ReactNode;
}

const pinstripe = new PinstripeClient();

function handleOnMutationError(error: PinstripeError) {
  toast.show(error.message, { isError: true });
}

function handleOnMutationSuccess(message: string) {
  toast.show(message);
}

export function AdminPinstripeProvider({ children }: AdminPinstripeProviderProps) {
  return (
    <PinstripeProvider
      client={pinstripe}
      onMutationError={handleOnMutationError}
      onMutationSuccess={handleOnMutationSuccess}
    >
      {children}
    </PinstripeProvider>
  );
}
