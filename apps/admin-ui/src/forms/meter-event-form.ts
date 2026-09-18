import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateMeterEventPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const meterEventFormSchema = z.object({
  customerId: z.string().min(1, 'Chọn khách hàng'),
  value: z.number({ message: 'Giá trị phải là số' }).min(0, 'Giá trị không âm'),
  identifier: z.string(),
  timestamp: z.string(),
});

export type MeterEventFormData = z.infer<typeof meterEventFormSchema>;

export const meterEventFormResolver = zodResolver(meterEventFormSchema);

export const meterEventFormDefaultValues: MeterEventFormData = {
  customerId: '',
  value: 1,
  identifier: '',
  timestamp: '',
};

export function meterEventFormDataToPayload(
  eventName: string,
  valueKey: string,
  formData: MeterEventFormData,
): CreateMeterEventPayload {
  const timestamp = formData.timestamp ? new Date(formData.timestamp).toISOString() : undefined;

  return {
    eventName,
    customerId: formData.customerId,
    identifier: formData.identifier || undefined,
    timestamp,
    value: formData.value,
    payload: { [valueKey]: formData.value },
  };
}
