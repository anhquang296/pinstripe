import type { MutationProps } from '@react/react-query.types';
import { useVxrErpMutationCallbacks } from '@react/useVxrErpMutationCallbacks';
import { useVxrErpContext } from '@react/vxr-erp.provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatePricePayload, PriceResponse, UpdatePricePayload } from '@type/contracts.types';

export function useCreatePriceMutation({ successMessage }: MutationProps<PriceResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreatePricePayload) => {
      return client.prices.create(payload);
    },
    onSuccess: (price) => {
      queryClient.invalidateQueries({ queryKey: queries.price.prices._def });
      notifySuccess(price);
    },
    onError: notifyError,
  });
}

export function useUpdatePriceMutation({ successMessage }: MutationProps<PriceResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePricePayload }) => {
      return client.prices.update(id, payload);
    },
    onSuccess: (price, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.price.price(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.price.prices._def });
      notifySuccess(price);
    },
    onError: notifyError,
  });
}
