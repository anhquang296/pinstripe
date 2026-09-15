import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateProductPayload, UpdateProductPayload } from '@pinstripe/core/contracts';
import { createProduct, updateProduct } from '@api/products/products.api';
import type { MutationProps } from '@lib/react-query.types';
import { toast } from '@lib/toast';
import { queries } from '@react-query-keys/index';

export function useCreateProductMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProductPayload) => {
      return createProduct(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queries.product.products._def });

      if (shouldBeSuccessToast) {
        toast.show('Đã tạo product.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}

export function useUpdateProductMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProductPayload }) => {
      return updateProduct(id, payload);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.product.product(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.product.products._def });

      if (shouldBeSuccessToast) {
        toast.show('Đã cập nhật product.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}
