import type { MutationProps } from '@react/react-query.types';
import { useVxrErpMutationCallbacks } from '@react/useVxrErpMutationCallbacks';
import { useVxrErpContext } from '@react/vxr-erp.provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiKeyResponse, CreateApiKeyPayload } from '@type/contracts.types';

export function useCreateApiKeyMutation({ successMessage }: MutationProps<ApiKeyResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateApiKeyPayload) => {
      return client.apiKeys.create(payload);
    },
    onSuccess: (apiKey) => {
      queryClient.invalidateQueries({ queryKey: queries.api_key.apiKeys._def });
      notifySuccess(apiKey);
    },
    onError: notifyError,
  });
}

export function useDeleteApiKeyMutation({ successMessage }: MutationProps<ApiKeyResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (apiKeyId: string) => {
      return client.apiKeys.delete(apiKeyId);
    },
    onSuccess: (apiKey) => {
      queryClient.invalidateQueries({ queryKey: queries.api_key.apiKeys._def });
      notifySuccess(apiKey);
    },
    onError: notifyError,
  });
}
