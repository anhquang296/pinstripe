import type { MutationProps } from '@react/react-query.types';
import { useVxrErpMutationCallbacks } from '@react/useVxrErpMutationCallbacks';
import { useVxrErpContext } from '@react/vxr-erp.provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateProductPayload,
  ProductResponse,
  UpdateProductPayload,
} from '@type/contracts.types';

export function useCreateProductMutation({ successMessage }: MutationProps<ProductResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

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

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

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
