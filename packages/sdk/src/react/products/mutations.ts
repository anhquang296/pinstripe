import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateProductPayload,
  ProductResponse,
  UpdateProductPayload,
} from '@type/contracts.types';

export function useCreateProductMutation({ successMessage }: MutationProps<ProductResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateProductPayload) => {
      return client.products.create(payload);
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: queries.product.products._def });
      notifySuccess(product);
    },
    onError: notifyError,
  });
}

export function useUpdateProductMutation({ successMessage }: MutationProps<ProductResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProductPayload }) => {
      return client.products.update(id, payload);
    },
    onSuccess: (product, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.product.product(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.product.products._def });
      notifySuccess(product);
    },
    onError: notifyError,
  });
}
