import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCreditNotePayload,
  CreateInvoicePayload,
  CreditNoteResponse,
  InvoiceResponse,
  PayInvoicePayload,
  VoidInvoicePayload,
} from '@type/contracts.types';

function useInvoiceInvalidation() {
  const queryClient = useQueryClient();
  const { queries } = usePinstripeContext();

  return () => {
    queryClient.invalidateQueries({ queryKey: queries.invoice.invoices._def });
    queryClient.invalidateQueries({ queryKey: queries.invoice.creditNotes._def });
    queryClient.invalidateQueries({ queryKey: queries.ledger.accounts._def });
    queryClient.invalidateQueries({ queryKey: queries.ledger.transactions._def });
  };
}

export function useCreateInvoiceMutation({ successMessage }: MutationProps<InvoiceResponse> = {}) {
  const { client } = usePinstripeContext();
  const invalidate = useInvoiceInvalidation();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateInvoicePayload) => {
      return client.invoices.create(payload);
    },
    onSuccess: (invoice) => {
      invalidate();
      notifySuccess(invoice);
    },
    onError: notifyError,
  });
}

export function useFinalizeInvoiceMutation({
  successMessage,
}: MutationProps<InvoiceResponse> = {}) {
  const { client } = usePinstripeContext();
  const invalidate = useInvoiceInvalidation();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (invoiceId: string) => {
      return client.invoices.finalize(invoiceId);
    },
    onSuccess: (invoice) => {
      invalidate();
      notifySuccess(invoice);
    },
    onError: notifyError,
  });
}

export function usePayInvoiceMutation({ successMessage }: MutationProps<InvoiceResponse> = {}) {
  const { client } = usePinstripeContext();
  const invalidate = useInvoiceInvalidation();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PayInvoicePayload }) => {
      return client.invoices.pay(id, payload);
    },
    onSuccess: (invoice) => {
      invalidate();
      notifySuccess(invoice);
    },
    onError: notifyError,
  });
}

export function useVoidInvoiceMutation({ successMessage }: MutationProps<InvoiceResponse> = {}) {
  const { client } = usePinstripeContext();
  const invalidate = useInvoiceInvalidation();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: VoidInvoicePayload }) => {
      return client.invoices.void(id, payload);
    },
    onSuccess: (invoice) => {
      invalidate();
      notifySuccess(invoice);
    },
    onError: notifyError,
  });
}

export function useCreateCreditNoteMutation({
  successMessage,
}: MutationProps<CreditNoteResponse> = {}) {
  const { client } = usePinstripeContext();
  const invalidate = useInvoiceInvalidation();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateCreditNotePayload) => {
      return client.creditNotes.create(payload);
    },
    onSuccess: (creditNote) => {
      invalidate();
      notifySuccess(creditNote);
    },
    onError: notifyError,
  });
}
