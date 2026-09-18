import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CheckoutSessionResponse, CreateCheckoutSessionPayload } from '@type/contracts.types';

export function useCreateCheckoutSessionMutation({
  successMessage,
}: MutationProps<CheckoutSessionResponse> = {}) {
  const queryClient = useQueryClient();
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateCheckoutSessionPayload) => {
      return client.checkout.sessions.create(payload);
    },
    onSuccess: (checkoutSession) => {
      queryClient.invalidateQueries({ queryKey: queries.checkout.sessions._def });
      notifySuccess(checkoutSession);
    },
    onError: notifyError,
  });
}
