import Button from '@components/ui/Button';
import SelectField from '@components/ui/SelectField';
import TextField from '@components/ui/TextField';
import type { MeterFormData } from '@forms/meter-form';
import { MeterAggregationEnum } from '@pinstripe/core/contracts';
import type { UseFormReturn } from 'react-hook-form';

const AGGREGATION_OPTIONS = [
  { value: MeterAggregationEnum.SUM, label: 'sum — cộng dồn giá trị' },
  { value: MeterAggregationEnum.COUNT, label: 'count — đếm số event' },
  { value: MeterAggregationEnum.MAX, label: 'max — giá trị lớn nhất' },
  { value: MeterAggregationEnum.UNIQUE_COUNT, label: 'unique_count — đếm giá trị khác nhau' },
];

interface MeterFormProps {
  form: UseFormReturn<MeterFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function MeterForm({ form, isSaving, onSave }: MeterFormProps) {
  const { errors } = form.formState;

  return (
    <form
      className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={onSave}
    >
      <TextField
        label="Tên hiển thị"
        placeholder="API tokens"
        error={errors.displayName?.message}
        {...form.register('displayName')}
      />
      <TextField
        label="Tên event"
        placeholder="api_request"
        error={errors.eventName?.message}
        {...form.register('eventName')}
      />
      <SelectField
        label="Tổng hợp"
        options={AGGREGATION_OPTIONS}
        error={errors.aggregation?.message}
        {...form.register('aggregation')}
      />
      <TextField
        label="Khóa giá trị"
        placeholder="tokens"
        error={errors.valueKey?.message}
        {...form.register('valueKey')}
      />
      <Button type="submit" disabled={isSaving}>
        Tạo meter
      </Button>
    </form>
  );
}
