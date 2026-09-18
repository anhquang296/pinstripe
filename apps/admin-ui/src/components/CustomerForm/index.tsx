import Button from '@components/ui/Button';
import TextField from '@components/ui/TextField';
import type { CustomerFormData } from '@forms/customer-form';
import type { UseFormReturn } from 'react-hook-form';

interface CustomerFormProps {
  form: UseFormReturn<CustomerFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function CustomerForm({ form, isSaving, onSave }: CustomerFormProps) {
  const { errors } = form.formState;

  return (
    <form
      className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={onSave}
    >
      <TextField
        label="Email"
        placeholder="ke.toan@congty.vn"
        error={errors.email?.message}
        {...form.register('email')}
      />
      <TextField
        label="Tên"
        placeholder="Công ty ABC"
        error={errors.name?.message}
        {...form.register('name')}
      />
      <TextField
        label="Mã nhà xe Vexere"
        placeholder="Không bắt buộc"
        error={errors.vexereOperatorId?.message}
        {...form.register('vexereOperatorId')}
      />
      <Button type="submit" disabled={isSaving}>
        Tạo customer
      </Button>
    </form>
  );
}
