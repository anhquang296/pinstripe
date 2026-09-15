import { reverseLedgerTransaction } from '@api/ledger';
import type { MutationProps } from '@lib/react-query.types';
import { toast } from '@lib/toast';
import type { ReverseLedgerTransactionPayload } from '@pinstripe/core/contracts';
import { queries } from '@react-query-keys/index';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
