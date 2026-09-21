import RenderCheckboxField from '@common/components/FormField/RenderCheckboxField';
import RenderNumberField from '@common/components/FormField/RenderNumberField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { InvoiceItemFormData } from '@common/forms/invoice-item-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface InvoiceItemFormProps {
  mode: 'create' | 'edit';
  form: UseFormReturn<InvoiceItemFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function InvoiceItemForm({ mode, form, isSaving, onSave }: InvoiceItemFormProps) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderTextField
        control={form.control}
        name="description"
        label="Diễn giải"
        placeholder="Phí dịch vụ tháng 9"
      />
      <RenderNumberField control={form.control} name="quantity" label="Số lượng" minValue={0} />
      <RenderNumberField control={form.control} name="unitAmount" label="Đơn giá" minValue={0} />
      <RenderCheckboxField control={form.control} name="discountable" label="Được giảm giá" />
      <Button type="submit" isDisabled={isSaving}>
        {mode === 'create' ? 'Thêm dòng' : 'Lưu dòng'}
      </Button>
    </form>
  );
}
