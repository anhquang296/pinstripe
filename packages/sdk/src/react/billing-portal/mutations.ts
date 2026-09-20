import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  BillingPortalConfigurationResponse,
  BillingPortalSessionResponse,
  CreateBillingPortalConfigurationPayload,
  CreateBillingPortalSessionPayload,
  UpdateBillingPortalConfigurationPayload,
} from '@type/contracts.types';

export function useCreateBillingPortalConfigurationMutation({
  successMessage,
}: MutationProps<BillingPortalConfigurationResponse> = {}) {
  const queryClient = useQueryClient();
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateBillingPortalConfigurationPayload) => {
      return client.billingPortal.configurations.create(payload);
    },
    onSuccess: (configuration) => {
      queryClient.invalidateQueries({ queryKey: queries.billing_portal.configurations._def });
      notifySuccess(configuration);
    },
    onError: notifyError,
  });
}

export function useUpdateBillingPortalConfigurationMutation({
  successMessage,
}: MutationProps<BillingPortalConfigurationResponse> = {}) {
  const queryClient = useQueryClient();
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateBillingPortalConfigurationPayload;
    }) => {
      return client.billingPortal.configurations.update(id, payload);
    },
    onSuccess: (configuration, { id }) => {
      queryClient.invalidateQueries({
        queryKey: queries.billing_portal.configuration(id).queryKey,
      });
      queryClient.invalidateQueries({ queryKey: queries.billing_portal.configurations._def });
      notifySuccess(configuration);
    },
    onError: notifyError,
  });
}

export function useCreateBillingPortalSessionMutation({
  successMessage,
}: MutationProps<BillingPortalSessionResponse> = {}) {
  const queryClient = useQueryClient();
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateBillingPortalSessionPayload) => {
      return client.billingPortal.sessions.create(payload);
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: queries.billing_portal.session._def });
      notifySuccess(session);
    },
    onError: notifyError,
  });
}
