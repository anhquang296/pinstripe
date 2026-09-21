import { toEnumMember } from '@common/utils/enum';
import { zodResolver } from '@hookform/resolvers/zod';
import { MeterAggregationEnum } from '@vxrerp/core/contracts';
import type { CreateMeterPayload, MeterResponse, UpdateMeterPayload } from '@vxrerp/sdk';
import { z } from 'zod';

const meterFormSchema = z.object({
  displayName: z.string().min(1, 'Tên hiển thị là bắt buộc'),
  eventName: z.string().min(1, 'Tên event là bắt buộc'),
  aggregation: z.nativeEnum(MeterAggregationEnum, { message: 'Chọn cách tổng hợp' }),
  valueKey: z.string().min(1, 'Khóa giá trị là bắt buộc'),
});

export type MeterFormData = z.infer<typeof meterFormSchema>;

export const meterFormResolver = zodResolver(meterFormSchema);

export const meterFormDefaultValues: MeterFormData = {
  displayName: '',
  eventName: '',
  aggregation: MeterAggregationEnum.SUM,
  valueKey: 'value',
};

export function meterFormDataToPayload(formData: MeterFormData): CreateMeterPayload {
  return {
    displayName: formData.displayName,
    eventName: formData.eventName,
    aggregation: formData.aggregation,
    valueKey: formData.valueKey,
  };
}

export function meterToFormData(meter: MeterResponse): MeterFormData {
  return {
    displayName: meter.displayName,
    eventName: meter.eventName,
    aggregation: toEnumMember(MeterAggregationEnum, meter.aggregation, MeterAggregationEnum.SUM),
    valueKey: meter.valueKey,
  };
}

export function meterFormDataToUpdatePayload(formData: MeterFormData): UpdateMeterPayload {
  return {
    displayName: formData.displayName,
  };
}
