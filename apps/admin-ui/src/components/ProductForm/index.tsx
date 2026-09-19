import RenderTextField from '@components/fields/RenderTextField';
import type { ProductFormData } from '@forms/product-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface ProductFormProps {
  mode: 'create' | 'edit';
  form: UseFormReturn<ProductFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function ProductForm({ mode, form, isSaving, onSave }: ProductFormProps) {
  return (
    <form
      className="border-app-border-soft flex flex-wrap items-end gap-4 rounded-md border bg-surface p-4"
      onSubmit={onSave}
    >
      <RenderTextField control={form.control} name="name" label="Tên" placeholder="Pinstripe Pro" />
      <RenderTextField
        control={form.control}
        name="description"
        label="Mô tả"
        placeholder="Gói dành cho doanh nghiệp"
      />
      <RenderTextField control={form.control} name="unitLabel" label="Đơn vị" placeholder="seat" />
      <Button type="submit" isDisabled={isSaving}>
        {mode === 'create' ? 'Tạo product' : 'Lưu thay đổi'}
      </Button>
    </form>
  );
}
