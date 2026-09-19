import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateMeterEventBatchPayload } from '@pinstripe/sdk';
import { map } from 'lodash-es';
import { z } from 'zod';

const meterEventBatchLineSchema = z.object({
  customerId: z.string().min(1, 'Chọn khách hàng'),
  value: z.number({ message: 'Giá trị phải là số' }).min(0, 'Giá trị không âm'),
});

const meterEventBatchFormSchema = z.object({
  lines: z.array(meterEventBatchLineSchema).min(1, 'Batch cần ít nhất một dòng'),
});

export type MeterEventBatchFormData = z.infer<typeof meterEventBatchFormSchema>;

export type MeterEventBatchLineFormData = MeterEventBatchFormData['lines'][number];

export const meterEventBatchFormResolver = zodResolver(meterEventBatchFormSchema);

export const meterEventBatchFormDefaultValues: MeterEventBatchFormData = {
  lines: [{ customerId: '', value: 1 }],
};

export function meterEventBatchFormDataToPayload(
  eventName: string,
  valueKey: string,
  formData: MeterEventBatchFormData,
): CreateMeterEventBatchPayload {
  return {
    events: map(formData.lines, (line) => {
      return {
        eventName,
        customerId: line.customerId,
        value: line.value,
        payload: { [valueKey]: line.value },
      };
    }),
  };
}
