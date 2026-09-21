import type { MutationProps } from '@react/react-query.types';
import { useVxrErpMutationCallbacks } from '@react/useVxrErpMutationCallbacks';
import { useVxrErpContext } from '@react/vxr-erp.provider';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePortalLinkPayload,
  CreatePortalRequestPayload,
  PortalLinkResponse,
  PortalRequestResponse,
  PortalSessionResponse,
  RedeemPortalLinkPayload,
  SwitchPortalCustomerPayload,
} from '@type/contracts.types';

export function useCreatePortalLinkMutation({
  successMessage,
}: MutationProps<PortalLinkResponse> = {}) {
  const { client } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreatePortalLinkPayload) => {
      return client.portal.links.create(payload);
    },
    onSuccess: notifySuccess,
    onError: notifyError,
  });
}

export function useCreatePortalRequestMutation({
  successMessage,
}: MutationProps<PortalRequestResponse> = {}) {
  const { client } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreatePortalRequestPayload) => {
      return client.portal.requests.create(payload);
    },
    onSuccess: notifySuccess,
    onError: notifyError,
  });
}

export function useCreatePortalSessionMutation({
  successMessage,
}: MutationProps<PortalSessionResponse> = {}) {
  const queryClient = useQueryClient();

  const { client } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: RedeemPortalLinkPayload) => {
      return client.portal.sessions.create(payload);
    },
    onSuccess: (portalSession) => {
      queryClient.removeQueries({ queryKey: [VxrErpQuerySubjectEnum.PORTAL] });
      notifySuccess(portalSession);
    },
    onError: notifyError,
  });
}

export function useUpdatePortalSessionMutation({
  successMessage,
}: MutationProps<PortalSessionResponse> = {}) {
  const queryClient = useQueryClient();

  const { client } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: SwitchPortalCustomerPayload) => {
      return client.portal.sessions.update(payload);
    },
    onSuccess: (portalSession) => {
      queryClient.invalidateQueries({ queryKey: [VxrErpQuerySubjectEnum.PORTAL] });
      notifySuccess(portalSession);
    },
    onError: notifyError,
  });
}

export function useDeletePortalSessionMutation({
  successMessage,
}: MutationProps<PortalSessionResponse> = {}) {
  const queryClient = useQueryClient();

  const { client } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: () => {
      return client.portal.sessions.delete();
    },
    onSuccess: (portalSession) => {
      queryClient.removeQueries({ queryKey: [VxrErpQuerySubjectEnum.PORTAL] });
      notifySuccess(portalSession);
    },
    onError: notifyError,
  });
}
