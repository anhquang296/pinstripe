'use client';

import { toast } from '@libs/toast';
import type { VxrErpError } from '@vxrerp/sdk';
import { VxrErpClient } from '@vxrerp/sdk';
import { VxrErpProvider } from '@vxrerp/sdk/react';
import { get } from 'lodash-es';
import type { ReactNode } from 'react';

interface PortalVxrErpProviderProps {
  children: ReactNode;
}

const ERROR_MESSAGES_BY_STATUS: Record<number, string> = {
  401: 'Link đăng nhập hoặc phiên làm việc không còn hợp lệ. Vui lòng đăng nhập lại.',
  429: 'Bạn đã thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.',
};

const vxrErp = new VxrErpClient({ baseUrl: '/bff', maxRetries: 0 });

function handleOnMutationError(error: VxrErpError) {
  const message = get(ERROR_MESSAGES_BY_STATUS, error.statusCode, error.message);

  toast.show(message, { isError: true });
}

function handleOnMutationSuccess(message: string) {
  toast.show(message);
}

export function PortalVxrErpProvider({ children }: PortalVxrErpProviderProps) {
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
