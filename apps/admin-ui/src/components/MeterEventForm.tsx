import RenderDateField from '@components/fields/RenderDateField';
import RenderNumberField from '@components/fields/RenderNumberField';
import RenderSelectField from '@components/fields/RenderSelectField';
import RenderTextField from '@components/fields/RenderTextField';
import type { MeterEventFormData } from '@forms/meter-event-form';
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
      className="flex flex-wrap items-end gap-4"
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
      <RenderNumberField
        control={form.control}
        name="value"
        label="Giá trị"
        minValue={0}
        className="w-32"
      />
      <RenderTextField
        control={form.control}
        name="identifier"
        label="Mã chống trùng"
        placeholder="Để trống là sinh tự động"
      />
      <RenderDateField
        control={form.control}
        name="timestamp"
        label="Thời điểm"
        hasTime
        className="w-56"
      />
      <Button type="submit" isDisabled={isSaving}>
        Bắn một event
      </Button>
    </form>
  );
}
