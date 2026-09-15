import { confirmPaymentIntent, createPaymentIntent, createRefund } from '@api/payments';
import type { MutationProps } from '@lib/react-query.types';
import { toast } from '@lib/toast';
import type { CreateRefundPayload } from '@pinstripe/core/contracts';
import { queries } from '@react-query-keys/index';
import { useMutation, useQueryClient } from '@tanstack/react-query';

function usePaymentInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: queries.payment.paymentIntents._def });
    queryClient.invalidateQueries({ queryKey: queries.payment.refunds._def });
    queryClient.invalidateQueries({ queryKey: queries.invoice.invoices._def });
    queryClient.invalidateQueries({ queryKey: queries.ledger.accounts._def });
    queryClient.invalidateQueries({ queryKey: queries.ledger.transactions._def });
  };
}

export function useChargeInvoiceMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const invalidate = usePaymentInvalidation();

  return useMutation({
    mutationFn: async ({ invoiceId, paymentMethod }: ChargeInvoiceVariables) => {
      const paymentIntent = await createPaymentIntent({ invoiceId, paymentMethod });

      return confirmPaymentIntent(paymentIntent.id, { paymentMethod });
    },
    onSuccess: (paymentIntent) => {
      invalidate();

      if (paymentIntent.failureMessage) {
        toast.show(paymentIntent.failureMessage, { isError: true });

        return;
      }

      if (shouldBeSuccessToast) {
        toast.show('Đã thu tiền qua PSP.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}

export function useCreateRefundMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const invalidate = usePaymentInvalidation();

  return useMutation({
    mutationFn: (payload: CreateRefundPayload) => {
      return createRefund(payload);
    },
    onSuccess: () => {
      invalidate();

      if (shouldBeSuccessToast) {
        toast.show('Đã hoàn tiền.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}

interface ChargeInvoiceVariables {
  invoiceId: string;
  paymentMethod: string;
}
