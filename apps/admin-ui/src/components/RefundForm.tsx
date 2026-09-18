import RenderNumberField from '@components/fields/RenderNumberField';
import RenderSelectField from '@components/fields/RenderSelectField';
import RenderTextField from '@components/fields/RenderTextField';
import type { RefundFormData } from '@forms/refund-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface RefundFormProps {
  form: UseFormReturn<RefundFormData>;
  chargeOptions: { value: string; label: string }[];
  isSaving?: boolean;
  onSave: () => void;
}

export default function RefundForm({ form, chargeOptions, isSaving, onSave }: RefundFormProps) {
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
        name="chargeId"
        label="Charge"
        options={chargeOptions}
      />
      <RenderNumberField
        control={form.control}
        name="amount"
        label="Số tiền hoàn"
        minValue={1}
        className="w-40"
      />
      <RenderTextField
        control={form.control}
        name="reason"
        label="Lý do"
        placeholder="Khách huỷ dịch vụ"
      />
      <Button type="submit" isDisabled={isSaving}>
        Hoàn tiền
      </Button>
    </form>
  );
}
