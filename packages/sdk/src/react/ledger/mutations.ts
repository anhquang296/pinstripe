import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  LedgerTransactionResponse,
  PostLedgerTransactionPayload,
  ReverseLedgerTransactionPayload,
} from '@type/contracts.types';

function useLedgerInvalidation() {
  const queryClient = useQueryClient();
  const { queries } = usePinstripeContext();

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
  const { client } = usePinstripeContext();
  const invalidate = useLedgerInvalidation();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: PostLedgerTransactionPayload) => {
      return client.admin.ledgerTransactions.create(payload);
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
  const { client } = usePinstripeContext();
  const invalidate = useLedgerInvalidation();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReverseLedgerTransactionPayload }) => {
      return client.admin.ledgerTransactions.reverse(id, payload);
    },
    onSuccess: (ledgerTransaction, { id }) => {
      invalidate(id);
      notifySuccess(ledgerTransaction);
    },
    onError: notifyError,
  });
}
