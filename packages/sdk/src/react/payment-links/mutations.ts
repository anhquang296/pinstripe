import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
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
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

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
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

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
