import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateWebhookEndpointPayload,
  UpdateWebhookEndpointPayload,
  WebhookEndpointResponse,
} from '@type/contracts.types';

export function useCreateWebhookEndpointMutation({
  successMessage,
}: MutationProps<WebhookEndpointResponse> = {}) {
  const queryClient = useQueryClient();
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateWebhookEndpointPayload) => {
      return client.webhookEndpoints.create(payload);
    },
    onSuccess: (webhookEndpoint) => {
      queryClient.invalidateQueries({ queryKey: queries.webhook.endpoints._def });
      notifySuccess(webhookEndpoint);
    },
    onError: notifyError,
  });
}

export function useUpdateWebhookEndpointMutation({
  successMessage,
}: MutationProps<WebhookEndpointResponse> = {}) {
  const queryClient = useQueryClient();
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateWebhookEndpointPayload }) => {
      return client.webhookEndpoints.update(id, payload);
    },
    onSuccess: (webhookEndpoint) => {
      queryClient.invalidateQueries({ queryKey: queries.webhook.endpoints._def });
      notifySuccess(webhookEndpoint);
    },
    onError: notifyError,
  });
}
