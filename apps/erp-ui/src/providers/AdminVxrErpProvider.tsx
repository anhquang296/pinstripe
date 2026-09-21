import { toast } from '@libs/toast';
import type { VxrErpError } from '@vxrerp/sdk';
import { VxrErpClient } from '@vxrerp/sdk';
import { VxrErpProvider } from '@vxrerp/sdk/react';
import type { ReactNode } from 'react';

interface AdminVxrErpProviderProps {
  children: ReactNode;
}

const vxrErp = new VxrErpClient();

function handleOnMutationError(error: VxrErpError) {
  toast.show(error.message, { isError: true });
}

function handleOnMutationSuccess(message: string) {
  toast.show(message);
}

export function AdminVxrErpProvider({ children }: AdminVxrErpProviderProps) {
  return (
    <VxrErpProvider
      client={vxrErp}
      onMutationError={handleOnMutationError}
      onMutationSuccess={handleOnMutationSuccess}
    >
      {children}
    </VxrErpProvider>
  );
}
