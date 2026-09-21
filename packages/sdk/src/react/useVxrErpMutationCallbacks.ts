import type { VxrErpError } from '@errors/vxr-erp.error';
import type { MutationProps } from '@react/react-query.types';
import { useVxrErpContext } from '@react/vxr-erp.provider';

export interface VxrErpMutationCallbacksResult<TData> {
  notifySuccess: (data: TData) => void;
  notifyError: (error: VxrErpError) => void;
}

export function useVxrErpMutationCallbacks<TData>(
  successMessage: MutationProps<TData>['successMessage'],
): VxrErpMutationCallbacksResult<TData> {
  const { onMutationError, onMutationSuccess } = useVxrErpContext();

  const notifySuccess = (data: TData) => {
    const message = typeof successMessage === 'function' ? successMessage(data) : successMessage;

    if (message) {
      onMutationSuccess(message);
    }
  };

  return { notifySuccess, notifyError: onMutationError };
}
