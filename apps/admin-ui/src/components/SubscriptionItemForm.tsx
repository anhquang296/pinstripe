import RenderNumberField from '@components/fields/RenderNumberField';
import RenderSelectField from '@components/fields/RenderSelectField';
import type { SubscriptionItemFormData } from '@forms/subscription-item-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface SubscriptionItemFormProps {
  mode: 'create' | 'edit';
  form: UseFormReturn<SubscriptionItemFormData>;
  priceOptions: { value: string; label: string }[];
  isSaving?: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export default function SubscriptionItemForm({
  mode,
  form,
  priceOptions,
  isSaving,
  onSave,
  onCancel,
}: SubscriptionItemFormProps) {
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
        name="priceId"
        label="Bảng giá"
        options={priceOptions}
      />
      <RenderNumberField control={form.control} name="quantity" label="Số lượng" minValue={1} />
      <Button type="submit" isDisabled={isSaving}>
        {mode === 'create' ? 'Thêm dòng' : 'Lưu dòng'}
      </Button>
      <Button type="button" variant="ghost" onPress={onCancel}>
        Huỷ
      </Button>
    </form>
  );
}
