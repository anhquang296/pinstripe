import type { MutationProps } from '@react/react-query.types';
import { useVxrErpMutationCallbacks } from '@react/useVxrErpMutationCallbacks';
import { useVxrErpContext } from '@react/vxr-erp.provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CheckoutSessionResponse, CreateCheckoutSessionPayload } from '@type/contracts.types';

export function useCreateCheckoutSessionMutation({
  successMessage,
}: MutationProps<CheckoutSessionResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

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
