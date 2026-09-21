import type { MutationProps } from '@react/react-query.types';
import { useVxrErpMutationCallbacks } from '@react/useVxrErpMutationCallbacks';
import { useVxrErpContext } from '@react/vxr-erp.provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateMeterEventBatchPayload,
  CreateMeterEventBatchResponse,
  CreateMeterEventPayload,
  CreateMeterPayload,
  MeterEventResponse,
  MeterResponse,
  UpdateMeterPayload,
} from '@type/contracts.types';

export function useCreateMeterMutation({ successMessage }: MutationProps<MeterResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateMeterPayload) => {
      return client.billing.meters.create(payload);
    },
    onSuccess: (meter) => {
      queryClient.invalidateQueries({ queryKey: queries.meter.meters._def });
      notifySuccess(meter);
    },
    onError: notifyError,
  });
}

export function useUpdateMeterMutation({ successMessage }: MutationProps<MeterResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMeterPayload }) => {
      return client.billing.meters.update(id, payload);
    },
    onSuccess: (meter, { id }) => {
      queryClient.invalidateQueries({ queryKey: queries.meter.meter(id).queryKey });
      queryClient.invalidateQueries({ queryKey: queries.meter.meters._def });
      notifySuccess(meter);
    },
    onError: notifyError,
  });
}

export function useCreateMeterEventMutation({
  successMessage,
}: MutationProps<MeterEventResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateMeterEventPayload) => {
      return client.billing.meterEvents.create(payload);
    },
    onSuccess: (meterEvent) => {
      queryClient.invalidateQueries({ queryKey: queries.meter.eventSummary._def });
      notifySuccess(meterEvent);
    },
    onError: notifyError,
  });
}

export function useCreateMeterEventBatchMutation({
  successMessage,
}: MutationProps<CreateMeterEventBatchResponse> = {}) {
  const queryClient = useQueryClient();

  const { client, queries } = useVxrErpContext();

  const { notifySuccess, notifyError } = useVxrErpMutationCallbacks(successMessage);

  return useMutation({
    mutationFn: (payload: CreateMeterEventBatchPayload) => {
      return client.billing.meterEventBatches.create(payload);
    },
    onSuccess: (meterEventBatch) => {
      queryClient.invalidateQueries({ queryKey: queries.meter.eventSummary._def });
      notifySuccess(meterEventBatch);
    },
    onError: notifyError,
  });
}
