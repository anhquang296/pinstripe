import type { MutationProps } from '@react/react-query.types';
import { useVxrErpMutationCallbacks } from '@react/useVxrErpMutationCallbacks';
import { useVxrErpContext } from '@react/vxr-erp.provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AdvanceTestClockPayload,
  CreateTestClockPayload,
  TestClockResponse,
} from '@type/contracts.types';

export function useCreateTestClockMutation({
  successMessage,
}: MutationProps<TestClockResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateTestClockPayload) => {
      return client.testHelpers.testClocks.create(payload);
    },
    onSuccess: (testClock) => {
      queryClient.invalidateQueries({ queryKey: queries.test_clock.testClocks._def });
      notifySuccess(testClock);
    },
    onError: notifyError,
  });
}

export function useAdvanceTestClockMutation({
  successMessage,
}: MutationProps<TestClockResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdvanceTestClockPayload }) => {
      return client.testHelpers.testClocks.advance(id, payload);
    },
    onSuccess: (testClock) => {
      queryClient.invalidateQueries({ queryKey: queries.test_clock.testClocks._def });
      queryClient.invalidateQueries({ queryKey: queries.subscription.subscriptions._def });
      queryClient.invalidateQueries({ queryKey: queries.entitlement.entitlements._def });
      notifySuccess(testClock);
    },
    onError: notifyError,
  });
}
