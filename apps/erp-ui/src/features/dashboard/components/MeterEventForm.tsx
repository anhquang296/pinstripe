import RenderDateField from '@common/components/FormField/RenderDateField';
import RenderNumberField from '@common/components/FormField/RenderNumberField';
import RenderSelectField from '@common/components/FormField/RenderSelectField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { MeterEventFormData } from '@common/forms/meter-event-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface MeterEventFormProps {
  form: UseFormReturn<MeterEventFormData>;
  customerOptions: { value: string; label: string }[];
  isSaving?: boolean;
  onSave: () => void;
}

export default function MeterEventForm({
  form,
  customerOptions,
  isSaving,
  onSave,
}: MeterEventFormProps) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderSelectField
        control={form.control}
        name="customerId"
        label="Khách hàng"
        options={customerOptions}
      />
      <RenderNumberField control={form.control} name="value" label="Giá trị" minValue={0} />
      <RenderTextField
        control={form.control}
        name="identifier"
        label="Mã chống trùng"
        placeholder="Để trống là sinh tự động"
      />
      <RenderDateField control={form.control} name="timestamp" label="Thời điểm" hasTime />
      <Button type="submit" isDisabled={isSaving}>
        Bắn một event
      </Button>
    </form>
  );
}
