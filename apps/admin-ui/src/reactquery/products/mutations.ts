import { createProduct, updateProduct } from '@api/products';
import type { MutationProps } from '@lib/react-query.types';
import { toast } from '@lib/toast';
import type { CreateProductPayload, UpdateProductPayload } from '@pinstripe/core/contracts';
import { queries } from '@react-query-keys/index';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
