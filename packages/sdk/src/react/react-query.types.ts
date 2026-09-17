import type { PinstripeError } from '@errors/pinstripe.error';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: PinstripeError;
  }
}

export interface QueryProps {
  enabled?: boolean;
  hasPlaceholder?: boolean;
}

export interface MutationProps<TData = unknown> {
  successMessage?: string | ((data: TData) => string);
}
