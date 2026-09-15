import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReverseLedgerTransactionPayload } from '@pinstripe/core/contracts';
import { reverseLedgerTransaction } from '@api/ledger/ledger.api';
import type { MutationProps } from '@lib/react-query.types';
import { toast } from '@lib/toast';
import { queries } from '@react-query-keys/index';

export function useReverseLedgerTransactionMutation({
  shouldBeSuccessToast = true,
}: MutationProps = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReverseLedgerTransactionPayload }) => {
      return reverseLedgerTransaction(id, payload);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.ledger.transaction(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.ledger.transactions._def });
      queryClient.invalidateQueries({ queryKey: queries.ledger.accounts._def });

      if (shouldBeSuccessToast) {
        toast.show('Đã đảo bút toán.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}
