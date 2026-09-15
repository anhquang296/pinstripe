import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateCustomerPayload, UpdateCustomerPayload } from '@pinstripe/core/contracts';
import { createCustomer, updateCustomer } from '@api/customers/customers.api';
import type { MutationProps } from '@lib/react-query.types';
import { toast } from '@lib/toast';
import { queries } from '@react-query-keys/index';

export function useCreateCustomerMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCustomerPayload) => {
      return createCustomer(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queries.customer.customers._def });

      if (shouldBeSuccessToast) {
        toast.show('Đã tạo customer.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}

export function useUpdateCustomerMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCustomerPayload }) => {
      return updateCustomer(id, payload);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.customer.customer(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.customer.customers._def });

      if (shouldBeSuccessToast) {
        toast.show('Đã cập nhật customer.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}
