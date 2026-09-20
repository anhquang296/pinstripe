import { usePinstripeContext } from '@react/pinstripe.provider';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
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
  const { client } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

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
  const { client } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

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

  const { client } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: RedeemPortalLinkPayload) => {
      return client.portal.sessions.create(payload);
    },
    onSuccess: (portalSession) => {
      queryClient.removeQueries({ queryKey: [PinstripeQuerySubjectEnum.PORTAL] });
      notifySuccess(portalSession);
    },
    onError: notifyError,
  });
}

export function useUpdatePortalSessionMutation({
  successMessage,
}: MutationProps<PortalSessionResponse> = {}) {
  const queryClient = useQueryClient();

  const { client } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: SwitchPortalCustomerPayload) => {
      return client.portal.sessions.update(payload);
    },
    onSuccess: (portalSession) => {
      queryClient.invalidateQueries({ queryKey: [PinstripeQuerySubjectEnum.PORTAL] });
      notifySuccess(portalSession);
    },
    onError: notifyError,
  });
}

export function useDeletePortalSessionMutation({
  successMessage,
}: MutationProps<PortalSessionResponse> = {}) {
  const queryClient = useQueryClient();

  const { client } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: () => {
      return client.portal.sessions.delete();
    },
    onSuccess: (portalSession) => {
      queryClient.removeQueries({ queryKey: [PinstripeQuerySubjectEnum.PORTAL] });
      notifySuccess(portalSession);
    },
    onError: notifyError,
  });
}
