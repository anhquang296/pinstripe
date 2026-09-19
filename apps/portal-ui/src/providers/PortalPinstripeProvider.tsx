'use client';

import { toast } from '@libs/toast';
import type { PinstripeError } from '@pinstripe/sdk';
import { PinstripeClient } from '@pinstripe/sdk';
import { PinstripeProvider } from '@pinstripe/sdk/react';
import { get } from 'lodash-es';
import type { ReactNode } from 'react';

interface PortalPinstripeProviderProps {
  children: ReactNode;
}

const ERROR_MESSAGES_BY_STATUS: Record<number, string> = {
  401: 'Link đăng nhập hoặc phiên làm việc không còn hợp lệ. Vui lòng đăng nhập lại.',
  429: 'Bạn đã thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.',
};

const pinstripe = new PinstripeClient({ baseUrl: '/bff', maxRetries: 0 });

function handleOnMutationError(error: PinstripeError) {
  const message = get(ERROR_MESSAGES_BY_STATUS, error.statusCode, error.message);

  toast.show(message, { isError: true });
}

function handleOnMutationSuccess(message: string) {
  toast.show(message);
}

export function PortalPinstripeProvider({ children }: PortalPinstripeProviderProps) {
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
