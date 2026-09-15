import Button from '@components/ui/Button';
import TextField from '@components/ui/TextField';
import type { ProductFormData } from '@forms/product-form';
import type { UseFormReturn } from 'react-hook-form';

interface ProductFormProps {
  form: UseFormReturn<ProductFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function ProductForm({ form, isSaving, onSave }: ProductFormProps) {
  const { errors } = form.formState;

  return (
    <form
      className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={onSave}
    >
      <TextField
        label="Tên"
        placeholder="Pinstripe Pro"
        error={errors.name?.message}
        {...form.register('name')}
      />
      <TextField
        label="Mô tả"
        placeholder="Gói dành cho doanh nghiệp"
        error={errors.description?.message}
        {...form.register('description')}
      />
      <TextField
        label="Đơn vị"
        placeholder="seat"
        error={errors.unitLabel?.message}
        {...form.register('unitLabel')}
      />
      <Button type="submit" disabled={isSaving}>
        Tạo product
      </Button>
    </form>
  );
}
