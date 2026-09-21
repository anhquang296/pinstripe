import type { MutationProps } from '@react/react-query.types';
import { useVxrErpMutationCallbacks } from '@react/useVxrErpMutationCallbacks';
import { useVxrErpContext } from '@react/vxr-erp.provider';
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

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

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

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateWebhookEndpointPayload }) => {
      return client.webhookEndpoints.update(id, payload);
    },
    onSuccess: (webhookEndpoint, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.webhook.endpoint(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.webhook.endpoints._def });
      notifySuccess(webhookEndpoint);
    },
    onError: notifyError,
  });
}
