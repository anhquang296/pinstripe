import type { MutationProps } from '@react/react-query.types';
import { useVxrErpMutationCallbacks } from '@react/useVxrErpMutationCallbacks';
import { useVxrErpContext } from '@react/vxr-erp.provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  LedgerTransactionResponse,
  PostLedgerTransactionPayload,
  ReverseLedgerTransactionPayload,
} from '@type/contracts.types';

function useLedgerInvalidation() {
  const queryClient = useQueryClient();

  const { queries } = useVxrErpContext();

  return (transactionId?: string) => {
    if (transactionId) {
      queryClient.invalidateQueries({
        queryKey: queries.ledger.transaction(transactionId).queryKey,
      });
    }

    queryClient.invalidateQueries({ queryKey: queries.ledger.transactions._def });
    queryClient.invalidateQueries({ queryKey: queries.ledger.accounts._def });
    queryClient.invalidateQueries({ queryKey: queries.ledger.account._def });
  };
}

export function useCreateLedgerTransactionMutation({
  successMessage,
}: MutationProps<LedgerTransactionResponse> = {}) {
  const { client } = useVxrErpContext();

  const invalidate = useLedgerInvalidation();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: PostLedgerTransactionPayload) => {
      return client.ledger.transactions.create(payload);
    },
    onSuccess: (ledgerTransaction) => {
      invalidate();
      notifySuccess(ledgerTransaction);
    },
    onError: notifyError,
  });
}

export function useReverseLedgerTransactionMutation({
  successMessage,
}: MutationProps<LedgerTransactionResponse> = {}) {
  const { client } = useVxrErpContext();

  const invalidate = useLedgerInvalidation();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReverseLedgerTransactionPayload }) => {
      return client.ledger.transactions.reverse(id, payload);
    },
    onSuccess: (ledgerTransaction, { id }) => {
      invalidate(id);
      notifySuccess(ledgerTransaction);
    },
    onError: notifyError,
  });
}
