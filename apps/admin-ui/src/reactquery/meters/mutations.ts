import type { CreateMeterEventPayload, CreateMeterPayload } from '@api/meters';
import { createMeter, createMeterEvent } from '@api/meters';
import type { MutationProps } from '@lib/react-query.types';
import { toast } from '@lib/toast';
import { queries } from '@react-query-keys/index';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateMeterMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMeterPayload) => {
      return createMeter(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queries.meter.meters._def });

      if (shouldBeSuccessToast) {
        toast.show('Đã tạo meter.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}

export function useCreateMeterEventMutation({ shouldBeSuccessToast = true }: MutationProps = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMeterEventPayload) => {
      return createMeterEvent(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queries.meter.eventSummary._def });

      if (shouldBeSuccessToast) {
        toast.show('Đã ghi nhận usage event.');
      }
    },
    onError: (error) => {
      toast.show(error.message, { isError: true });
    },
  });
}
