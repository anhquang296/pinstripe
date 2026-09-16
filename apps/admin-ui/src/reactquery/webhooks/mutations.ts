import { createWebhookEndpoint, updateWebhookEndpoint } from '@api/webhooks';
import type { MutationProps } from '@lib/react-query.types';
import { toast } from '@lib/toast';
import type {
  CreateWebhookEndpointPayload,
  UpdateWebhookEndpointPayload,
} from '@pinstripe/core/contracts';
import { queries } from '@react-query-keys/index';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateWebhookEndpointMutation({
  shouldBeSuccessToast = true,
}: MutationProps = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateWebhookEndpointPayload) => {
      return createWebhookEndpoint(payload);
    },
    onSuccess: (endpoint) => {
      queryClient.invalidateQueries({ queryKey: queries.webhook.endpoints._def });

      if (shouldBeSuccessToast) {
        toast.show(`Đã tạo endpoint. Secret chỉ hiện một lần: ${endpoint.secret}`);
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}

export function useUpdateWebhookEndpointMutation({
  shouldBeSuccessToast = true,
}: MutationProps = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateWebhookEndpointPayload }) => {
      return updateWebhookEndpoint(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queries.webhook.endpoints._def });

      if (shouldBeSuccessToast) {
        toast.show('Đã cập nhật endpoint.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}
