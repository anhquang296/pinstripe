import type { MutationProps } from '@react/react-query.types';
import { useVxrErpMutationCallbacks } from '@react/useVxrErpMutationCallbacks';
import { useVxrErpContext } from '@react/vxr-erp.provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateUserPayload, UpdateUserPayload, UserResponse } from '@type/contracts.types';

export interface UpdateUserVariables {
  id: string;
  payload: UpdateUserPayload;
}

export function useCreateUserMutation({ successMessage }: MutationProps<UserResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateUserPayload) => {
      return client.users.create(payload);
    },
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: queries.user.users._def });
      notifySuccess(user);
    },
    onError: notifyError,
  });
}

export function useUpdateUserMutation({ successMessage }: MutationProps<UserResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: UpdateUserVariables) => {
      return client.users.update(id, payload);
    },
    onSuccess: (user, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.user.user(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.user.users._def });
      notifySuccess(user);
    },
    onError: notifyError,
  });
}
