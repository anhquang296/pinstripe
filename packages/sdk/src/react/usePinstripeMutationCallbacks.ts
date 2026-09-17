import type { PinstripeError } from '@errors/pinstripe.error';
import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';

export interface PinstripeMutationCallbacksResult<TData> {
  notifySuccess: (data: TData) => void;
  notifyError: (error: PinstripeError) => void;
}

export function usePinstripeMutationCallbacks<TData>(
  successMessage: MutationProps<TData>['successMessage'],
): PinstripeMutationCallbacksResult<TData> {
  const { onMutationError, onMutationSuccess } = usePinstripeContext();

  const notifySuccess = (data: TData) => {
    const message = typeof successMessage === 'function' ? successMessage(data) : successMessage;

    if (message) {
      onMutationSuccess(message);
    }
  };

  return { notifySuccess, notifyError: onMutationError };
}
