import RenderNumberField from '@common/components/FormField/RenderNumberField';
import RenderSelectField from '@common/components/FormField/RenderSelectField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { RefundFormData } from '@common/forms/refund-form';
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
      className="flex flex-col gap-4"
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
      <RenderNumberField control={form.control} name="amount" label="Số tiền hoàn" minValue={1} />
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
