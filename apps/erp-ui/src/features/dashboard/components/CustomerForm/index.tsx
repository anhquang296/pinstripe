import RenderSelectField from '@common/components/FormField/RenderSelectField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { CustomerFormData } from '@common/forms/customer-form';
import { Button } from '@heroui/react';
import { PartnerPlatformEnum } from '@vxrerp/billing/contracts';
import type { UseFormReturn } from 'react-hook-form';

interface CustomerFormProps {
  mode: 'create' | 'edit';
  form: UseFormReturn<CustomerFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

const partnerPlatformOptions = [
  { value: '', label: '— không có —' },
  { value: PartnerPlatformEnum.VEXERE, label: 'Vexere' },
];

export default function CustomerForm({ mode, form, isSaving, onSave }: CustomerFormProps) {
  return (
    <form className="flex flex-col gap-4" onSubmit={onSave}>
      <RenderTextField
        control={form.control}
        name="email"
        label="Email"
        placeholder="ke.toan@congty.vn"
      />
      <RenderTextField control={form.control} name="name" label="Tên" placeholder="Công ty ABC" />
      <RenderSelectField
        control={form.control}
        name="partnerPlatform"
        label="Nền tảng đối tác"
        options={partnerPlatformOptions}
      />
      <RenderTextField
        control={form.control}
        name="partnerAccountId"
        label="Mã tài khoản đối tác"
        placeholder="Không bắt buộc"
      />
      <Button type="submit" isDisabled={isSaving}>
        {mode === 'create' ? 'Tạo customer' : 'Lưu thay đổi'}
      </Button>
    </form>
  );
}
