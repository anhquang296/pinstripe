import { usePinstripeContext } from '@react/pinstripe.provider';
import type { MutationProps } from '@react/react-query.types';
import { usePinstripeMutationCallbacks } from '@react/usePinstripeMutationCallbacks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateTaxIdPayload,
  CreateTaxRatePayload,
  DeletedTaxIdResponse,
  TaxIdResponse,
  TaxRateResponse,
  UpdateTaxRatePayload,
} from '@type/contracts.types';

export function useCreateTaxRateMutation({ successMessage }: MutationProps<TaxRateResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateTaxRatePayload) => {
      return client.taxRates.create(payload);
    },
    onSuccess: (taxRate) => {
      queryClient.invalidateQueries({ queryKey: queries.tax.taxRates._def });
      notifySuccess(taxRate);
    },
    onError: notifyError,
  });
}

export function useUpdateTaxRateMutation({ successMessage }: MutationProps<TaxRateResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTaxRatePayload }) => {
      return client.taxRates.update(id, payload);
    },
    onSuccess: (taxRate, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.tax.taxRate(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.tax.taxRates._def });
      notifySuccess(taxRate);
    },
    onError: notifyError,
  });
}

export function useCreateTaxIdMutation({ successMessage }: MutationProps<TaxIdResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateTaxIdPayload) => {
      return client.taxIds.create(payload);
    },
    onSuccess: (taxId) => {
      queryClient.invalidateQueries({ queryKey: queries.tax.taxIds._def });
      notifySuccess(taxId);
    },
    onError: notifyError,
  });
}

export function useDeleteTaxIdMutation({
  successMessage,
}: MutationProps<DeletedTaxIdResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = usePinstripeContext();

  const { notifySuccess, notifyError } = usePinstripeMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (taxIdId: string) => {
      return client.taxIds.delete(taxIdId);
    },
    onSuccess: (deletedTaxId, taxIdId) => {
      queryClient.invalidateQueries({ queryKey: queries.tax.taxId(taxIdId).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.tax.taxIds._def });
      notifySuccess(deletedTaxId);
    },
    onError: notifyError,
  });
}
