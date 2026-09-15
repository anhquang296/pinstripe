import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdvanceTestClockPayload, CreateTestClockPayload } from '@pinstripe/core/contracts';
import { advanceTestClock, createTestClock } from '@api/test-clocks/test-clocks.api';
import type { MutationProps } from '@lib/react-query.types';
import { toast } from '@lib/toast';
import { queries } from '@react-query-keys/index';

export function useCreateTestClockMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTestClockPayload) => {
      return createTestClock(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queries.test_clock.testClocks._def });

      if (shouldBeSuccessToast) {
        toast.show('Đã tạo test clock.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}

export function useAdvanceTestClockMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdvanceTestClockPayload }) => {
      return advanceTestClock(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queries.test_clock.testClocks._def });
      queryClient.invalidateQueries({ queryKey: queries.subscription.subscriptions._def });
      queryClient.invalidateQueries({ queryKey: queries.entitlement.entitlements._def });

      if (shouldBeSuccessToast) {
        toast.show('Đã tua đồng hồ.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}
