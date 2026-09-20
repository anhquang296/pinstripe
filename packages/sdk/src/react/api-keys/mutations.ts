import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiKeyResponse, CreateApiKeyPayload } from '@type/contracts.types';

export function useCreateApiKeyMutation({ successMessage }: MutationProps<ApiKeyResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

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

  const { client, queries } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

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
