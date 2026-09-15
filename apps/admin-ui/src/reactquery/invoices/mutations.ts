import { createCreditNote } from '@api/credit-notes';
import { createInvoice, finalizeInvoice, payInvoice, voidInvoice } from '@api/invoices';
import type { MutationProps } from '@lib/react-query.types';
import { toast } from '@lib/toast';
import type {
  CreateCreditNotePayload,
  CreateInvoicePayload,
  PayInvoicePayload,
  VoidInvoicePayload,
} from '@pinstripe/core/contracts';
import { queries } from '@react-query-keys/index';
import { useMutation, useQueryClient } from '@tanstack/react-query';

function useInvoiceInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: queries.invoice.invoices._def });
    queryClient.invalidateQueries({ queryKey: queries.invoice.creditNotes._def });
    queryClient.invalidateQueries({ queryKey: queries.ledger.accounts._def });
    queryClient.invalidateQueries({ queryKey: queries.ledger.transactions._def });
  };
}

export function useCreateInvoiceMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const invalidate = useInvoiceInvalidation();

  return useMutation({
    mutationFn: (payload: CreateInvoicePayload) => {
      return createInvoice(payload);
    },
    onSuccess: () => {
      invalidate();

      if (shouldBeSuccessToast) {
        toast.show('Đã tạo hóa đơn nháp.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}

export function useFinalizeInvoiceMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const invalidate = useInvoiceInvalidation();

  return useMutation({
    mutationFn: (invoiceId: string) => {
      return finalizeInvoice(invoiceId);
    },
    onSuccess: (invoice) => {
      invalidate();

      if (shouldBeSuccessToast) {
        toast.show(`Đã phát hành ${invoice.number}.`);
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}

export function usePayInvoiceMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const invalidate = useInvoiceInvalidation();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PayInvoicePayload }) => {
      return payInvoice(id, payload);
    },
    onSuccess: () => {
      invalidate();

      if (shouldBeSuccessToast) {
        toast.show('Đã ghi nhận thanh toán.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}

export function useVoidInvoiceMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const invalidate = useInvoiceInvalidation();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: VoidInvoicePayload }) => {
      return voidInvoice(id, payload);
    },
    onSuccess: () => {
      invalidate();

      if (shouldBeSuccessToast) {
        toast.show('Đã hủy hóa đơn.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}

export function useCreateCreditNoteMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const invalidate = useInvoiceInvalidation();

  return useMutation({
    mutationFn: (payload: CreateCreditNotePayload) => {
      return createCreditNote(payload);
    },
    onSuccess: (creditNote) => {
      invalidate();

      if (shouldBeSuccessToast) {
        toast.show(`Đã tạo ${creditNote.number}.`);
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}
