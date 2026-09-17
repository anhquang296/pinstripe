import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCustomerBalanceTransactionPayload,
  CreateCustomerPayload,
  CustomerBalanceTransactionResponse,
  CustomerResponse,
  UpdateCustomerPayload,
} from '@type/contracts.types';

export function useCreateCustomerMutation({
  successMessage,
}: MutationProps<CustomerResponse> = {}) {
  const queryClient = useQueryClient();
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateCustomerPayload) => {
      return client.customers.create(payload);
    },
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: queries.customer.customers._def });
      notifySuccess(customer);
    },
    onError: notifyError,
  });
}

export function useUpdateCustomerMutation({
  successMessage,
}: MutationProps<CustomerResponse> = {}) {
  const queryClient = useQueryClient();
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCustomerPayload }) => {
      return client.customers.update(id, payload);
    },
    onSuccess: (customer, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.customer.customer(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.customer.customers._def });
      notifySuccess(customer);
    },
    onError: notifyError,
  });
}

export interface CreateCustomerBalanceTransactionVariables {
  id: string;
  payload: CreateCustomerBalanceTransactionPayload;
}

export function useCreateCustomerBalanceTransactionMutation({
  successMessage,
}: MutationProps<CustomerBalanceTransactionResponse> = {}) {
  const queryClient = useQueryClient();
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: CreateCustomerBalanceTransactionVariables) => {
      return client.customers.createBalanceTransaction(id, payload);
    },
    onSuccess: (balanceTransaction, { id }) => {
      queryClient.invalidateQueries({
        queryKey: queries.customer.customer(id)._ctx.balanceTransactions._def,
      });
      queryClient.invalidateQueries({ queryKey: queries.customer.customer(id).queryKey });
      notifySuccess(balanceTransaction);
    },
    onError: notifyError,
  });
}

export function useDeleteCustomerMutation({ successMessage }: MutationProps = {}) {
  const queryClient = useQueryClient();
  const { client, queries } = usePinstripeContext();
  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (customerId: string) => {
      return client.customers.delete(customerId);
    },
    onSuccess: (deletedCustomer, customerId) => {
      queryClient.invalidateQueries({ queryKey: queries.customer.customer(customerId).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.customer.customers._def });
      notifySuccess(deletedCustomer);
    },
    onError: notifyError,
  });
}
