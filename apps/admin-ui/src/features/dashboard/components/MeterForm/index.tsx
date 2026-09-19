import RenderSelectField from '@common/components/FormField/RenderSelectField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { MeterFormData } from '@common/forms/meter-form';
import { Button } from '@heroui/react';
import { MeterAggregationEnum } from '@pinstripe/core/contracts';
import type { UseFormReturn } from 'react-hook-form';

const AGGREGATION_OPTIONS = [
  { value: MeterAggregationEnum.SUM, label: 'sum — cộng dồn giá trị' },
  { value: MeterAggregationEnum.COUNT, label: 'count — đếm số event' },
  { value: MeterAggregationEnum.MAX, label: 'max — giá trị lớn nhất' },
  { value: MeterAggregationEnum.UNIQUE_COUNT, label: 'unique_count — đếm giá trị khác nhau' },
];

interface MeterFormProps {
  mode: 'create' | 'edit';
  form: UseFormReturn<MeterFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function MeterForm({ mode, form, isSaving, onSave }: MeterFormProps) {
  return (
    <form className="flex flex-col gap-4" onSubmit={onSave}>
      <RenderTextField
        control={form.control}
        name="displayName"
        label="Tên hiển thị"
        placeholder="API tokens"
      />
      <RenderTextField
        control={form.control}
        name="eventName"
        label="Tên event"
        placeholder="api_request"
        isDisabled={mode === 'edit'}
      />
      <RenderSelectField
        control={form.control}
        name="aggregation"
        label="Tổng hợp"
        options={AGGREGATION_OPTIONS}
        isDisabled={mode === 'edit'}
      />
      <RenderTextField
        control={form.control}
        name="valueKey"
        label="Khóa giá trị"
        placeholder="tokens"
        isDisabled={mode === 'edit'}
      />
      <Button type="submit" isDisabled={isSaving}>
        {mode === 'create' ? 'Tạo meter' : 'Lưu thay đổi'}
      </Button>
    </form>
  );
}
