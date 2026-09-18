import Button from '@components/ui/Button';
import SelectField from '@components/ui/SelectField';
import TextField from '@components/ui/TextField';
import type { CustomerFormData } from '@forms/customer-form';
import { PartnerPlatformEnum } from '@pinstripe/core/contracts';
import type { UseFormReturn } from 'react-hook-form';

interface CustomerFormProps {
  form: UseFormReturn<CustomerFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

const partnerPlatformOptions = [
  { value: '', label: '— không có —' },
  { value: PartnerPlatformEnum.VEXERE, label: 'Vexere' },
];

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
      <SelectField
        label="Nền tảng đối tác"
        options={partnerPlatformOptions}
        error={errors.partnerPlatform?.message}
        {...form.register('partnerPlatform')}
      />
      <TextField
        label="Mã tài khoản đối tác"
        placeholder="Không bắt buộc"
        error={errors.partnerAccountId?.message}
        {...form.register('partnerAccountId')}
      />
      <Button type="submit" disabled={isSaving}>
        Tạo customer
      </Button>
    </form>
  );
}
