import type { VxrErpError } from '@errors/vxr-erp.error';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: VxrErpError;
  }
}

export interface QueryProps {
  enabled?: boolean;
  hasPlaceholder?: boolean;
}

export interface MutationProps<TData = unknown> {
  successMessage?: string | ((data: TData) => string);
}
