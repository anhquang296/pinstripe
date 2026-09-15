import type { PinstripeApiError } from '@api/client';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: PinstripeApiError;
  }
}

export interface QueryProps {
  enabled?: boolean;
  hasPlaceholder?: boolean;
}

export interface MutationProps {
  shouldBeSuccessToast?: boolean;
}
