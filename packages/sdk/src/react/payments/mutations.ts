import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateRefundPayload,
  PaymentIntentResponse,
  RefundResponse,
} from '@type/contracts.types';

export interface ChargeInvoiceVariables {
  invoiceId: string;
  paymentMethod: string;
}

function usePaymentInvalidation() {
  const queryClient = useQueryClient();
  const { queries } = usePinstripeContext();

  return () => {
    queryClient.invalidateQueries({ queryKey: queries.payment.paymentIntents._def });
    queryClient.invalidateQueries({ queryKey: queries.payment.refunds._def });
    queryClient.invalidateQueries({ queryKey: queries.invoice.invoices._def });
    queryClient.invalidateQueries({ queryKey: queries.ledger.accounts._def });
    queryClient.invalidateQueries({ queryKey: queries.ledger.transactions._def });
  };
}

export function useChargeInvoiceMutation({
  successMessage,
}: MutationProps<PaymentIntentResponse> = {}) {
  const { client } = usePinstripeContext();
  const invalidate = usePaymentInvalidation();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: async ({ invoiceId, paymentMethod }: ChargeInvoiceVariables) => {
      const paymentIntent = await client.paymentIntents.create({ invoiceId, paymentMethod });

      return client.paymentIntents.confirm(paymentIntent.id, { paymentMethod });
    },
    onSuccess: (paymentIntent) => {
      invalidate();
      notifySuccess(paymentIntent);
    },
    onError: notifyError,
  });
}

export function useCreateRefundMutation({ successMessage }: MutationProps<RefundResponse> = {}) {
  const { client } = usePinstripeContext();
  const invalidate = usePaymentInvalidation();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateRefundPayload) => {
      return client.refunds.create(payload);
    },
    onSuccess: (refund) => {
      invalidate();
      notifySuccess(refund);
    },
    onError: notifyError,
  });
}
