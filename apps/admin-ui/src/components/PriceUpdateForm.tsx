import RenderCheckboxField from '@components/fields/RenderCheckboxField';
import RenderTextField from '@components/fields/RenderTextField';
import type { PriceUpdateFormData } from '@forms/price-update-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface PriceUpdateFormProps {
  form: UseFormReturn<PriceUpdateFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function PriceUpdateForm({ form, isSaving, onSave }: PriceUpdateFormProps) {
  return (
    <form
      className="flex flex-wrap items-end gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderTextField
        control={form.control}
        name="nickname"
        label="Nickname"
        placeholder="Pro theo tháng"
      />
      <RenderCheckboxField control={form.control} name="active" label="Đang bán" />
      <Button type="submit" isDisabled={isSaving}>
        Lưu thay đổi
      </Button>
    </form>
  );
}
