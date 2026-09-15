import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CancelSubscriptionPayload,
  CreateSubscriptionPayload,
} from '@pinstripe/core/contracts';
import { cancelSubscription, createSubscription } from '@api/subscriptions/subscriptions.api';
import type { MutationProps } from '@lib/react-query.types';
import { toast } from '@lib/toast';
import { queries } from '@react-query-keys/index';

export function useCreateSubscriptionMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSubscriptionPayload) => {
      return createSubscription(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queries.subscription.subscriptions._def });
      queryClient.invalidateQueries({ queryKey: queries.entitlement.entitlements._def });

      if (shouldBeSuccessToast) {
        toast.show('Đã tạo subscription.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}

export function useCancelSubscriptionMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CancelSubscriptionPayload }) => {
      return cancelSubscription(id, payload);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.subscription.subscription(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.subscription.subscriptions._def });
      queryClient.invalidateQueries({ queryKey: queries.entitlement.entitlements._def });

      if (shouldBeSuccessToast) {
        toast.show('Đã hủy subscription.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}
