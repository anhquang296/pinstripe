import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePortalMembershipPayload,
  DeletedPortalMembershipResponse,
  PortalMembershipResponse,
  UpdatePortalMembershipPayload,
} from '@type/contracts.types';

export function useCreatePortalMembershipMutation({
  successMessage,
}: MutationProps<PortalMembershipResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreatePortalMembershipPayload) => {
      return client.portalMemberships.create(payload);
    },
    onSuccess: (portalMembership) => {
      queryClient.invalidateQueries({
        queryKey: queries.portal_membership.portalMemberships._def,
      });
      notifySuccess(portalMembership);
    },
    onError: notifyError,
  });
}

export function useUpdatePortalMembershipMutation({
  successMessage,
}: MutationProps<PortalMembershipResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePortalMembershipPayload }) => {
      return client.portalMemberships.update(id, payload);
    },
    onSuccess: (portalMembership) => {
      queryClient.invalidateQueries({
        queryKey: queries.portal_membership.portalMemberships._def,
      });
      notifySuccess(portalMembership);
    },
    onError: notifyError,
  });
}

export function useDeletePortalMembershipMutation({
  successMessage,
}: MutationProps<DeletedPortalMembershipResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (id: string) => {
      return client.portalMemberships.delete(id);
    },
    onSuccess: (deletedPortalMembership) => {
      queryClient.invalidateQueries({
        queryKey: queries.portal_membership.portalMemberships._def,
      });
      notifySuccess(deletedPortalMembership);
    },
    onError: notifyError,
  });
}
