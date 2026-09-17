import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CancelSubscriptionPayload,
  CreateSubscriptionPayload,
  SubscriptionResponse,
  UpdateSubscriptionPayload,
} from '@type/contracts.types';

export function useCreateSubscriptionMutation({
  successMessage,
}: MutationProps<SubscriptionResponse> = {}) {
  const queryClient = useQueryClient();
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateSubscriptionPayload) => {
      return client.subscriptions.create(payload);
    },
    onSuccess: (subscription) => {
      queryClient.invalidateQueries({ queryKey: queries.subscription.subscriptions._def });
      queryClient.invalidateQueries({ queryKey: queries.entitlement.entitlements._def });
      notifySuccess(subscription);
    },
    onError: notifyError,
  });
}

export function useUpdateSubscriptionMutation({
  successMessage,
}: MutationProps<SubscriptionResponse> = {}) {
  const queryClient = useQueryClient();
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSubscriptionPayload }) => {
      return client.subscriptions.update(id, payload);
    },
    onSuccess: (subscription, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.subscription.subscription(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.subscription.subscriptions._def });
      queryClient.invalidateQueries({ queryKey: queries.entitlement.entitlements._def });
      queryClient.invalidateQueries({ queryKey: queries.invoice.upcoming._def });
      queryClient.invalidateQueries({ queryKey: queries.invoice.invoices._def });
      notifySuccess(subscription);
    },
    onError: notifyError,
  });
}

export function useCancelSubscriptionMutation({
  successMessage,
}: MutationProps<SubscriptionResponse> = {}) {
  const queryClient = useQueryClient();
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CancelSubscriptionPayload }) => {
      return client.subscriptions.cancel(id, payload);
    },
    onSuccess: (subscription, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.subscription.subscription(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.subscription.subscriptions._def });
      queryClient.invalidateQueries({ queryKey: queries.entitlement.entitlements._def });
      notifySuccess(subscription);
    },
    onError: notifyError,
  });
}
