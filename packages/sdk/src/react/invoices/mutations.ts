import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCreditNotePayload,
  CreateInvoiceItemPayload,
  CreateInvoicePayload,
  CreditNoteResponse,
  DeletedInvoiceItemResponse,
  InvoiceItemResponse,
  InvoiceResponse,
  PayInvoicePayload,
  UpdateInvoiceItemPayload,
  VoidInvoicePayload,
} from '@type/contracts.types';

function useInvoiceInvalidation() {
  const queryClient = useQueryClient();
  const { queries } = usePinstripeContext();

  return (invoiceId: string) => {
    queryClient.invalidateQueries({ queryKey: queries.invoice.invoice(invoiceId).queryKey });
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
      invalidate(invoice.id);
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
      invalidate(invoice.id);
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
      invalidate(invoice.id);
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
      invalidate(invoice.id);
      notifySuccess(invoice);
    },
    onError: notifyError,
  });
}

function useInvoiceItemInvalidation() {
  const queryClient = useQueryClient();
  const { queries } = usePinstripeContext();

  return (invoiceItemId: string) => {
    queryClient.invalidateQueries({
      queryKey: queries.invoice.invoiceItem(invoiceItemId).queryKey,
    });
    queryClient.invalidateQueries({ queryKey: queries.invoice.invoiceItems._def });
    queryClient.invalidateQueries({ queryKey: queries.invoice.invoices._def });
  };
}

export function useCreateInvoiceItemMutation({
  successMessage,
}: MutationProps<InvoiceItemResponse> = {}) {
  const { client } = usePinstripeContext();
  const invalidate = useInvoiceItemInvalidation();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateInvoiceItemPayload) => {
      return client.invoiceItems.create(payload);
    },
    onSuccess: (invoiceItem) => {
      invalidate(invoiceItem.id);
      notifySuccess(invoiceItem);
    },
    onError: notifyError,
  });
}

export function useUpdateInvoiceItemMutation({
  successMessage,
}: MutationProps<InvoiceItemResponse> = {}) {
  const { client } = usePinstripeContext();
  const invalidate = useInvoiceItemInvalidation();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateInvoiceItemPayload }) => {
      return client.invoiceItems.update(id, payload);
    },
    onSuccess: (invoiceItem) => {
      invalidate(invoiceItem.id);
      notifySuccess(invoiceItem);
    },
    onError: notifyError,
  });
}

export function useDeleteInvoiceItemMutation({
  successMessage,
}: MutationProps<DeletedInvoiceItemResponse> = {}) {
  const { client } = usePinstripeContext();
  const invalidate = useInvoiceItemInvalidation();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (invoiceItemId: string) => {
      return client.invoiceItems.delete(invoiceItemId);
    },
    onSuccess: (deletedInvoiceItem) => {
      invalidate(deletedInvoiceItem.id);
      notifySuccess(deletedInvoiceItem);
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
      invalidate(creditNote.invoiceId);
      notifySuccess(creditNote);
    },
    onError: notifyError,
  });
}
