import type { MutationProps } from '@react/react-query.types';
import { useVxrErpMutationCallbacks } from '@react/useVxrErpMutationCallbacks';
import { useVxrErpContext } from '@react/vxr-erp.provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePaymentLinkPayload,
  PaymentLinkResponse,
  UpdatePaymentLinkPayload,
} from '@type/contracts.types';

export function useCreatePaymentLinkMutation({
  successMessage,
}: MutationProps<PaymentLinkResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreatePaymentLinkPayload) => {
      return client.paymentLinks.create(payload);
    },
    onSuccess: (paymentLink) => {
      queryClient.invalidateQueries({ queryKey: queries.payment_link.paymentLinks._def });
      notifySuccess(paymentLink);
    },
    onError: notifyError,
  });
}

export function useUpdatePaymentLinkMutation({
  successMessage,
}: MutationProps<PaymentLinkResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePaymentLinkPayload }) => {
      return client.paymentLinks.update(id, payload);
    },
    onSuccess: (paymentLink, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.payment_link.paymentLink(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.payment_link.paymentLinks._def });
      notifySuccess(paymentLink);
    },
    onError: notifyError,
  });
}
