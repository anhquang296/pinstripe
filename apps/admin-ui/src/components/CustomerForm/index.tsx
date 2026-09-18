import RenderSelectField from '@components/fields/RenderSelectField';
import RenderTextField from '@components/fields/RenderTextField';
import type { CustomerFormData } from '@forms/customer-form';
import { Button } from '@heroui/react';
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
  return (
    <form
      className="border-app-border-soft flex flex-wrap items-end gap-4 rounded-md border bg-surface p-4"
      onSubmit={onSave}
    >
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
        Tạo customer
      </Button>
    </form>
  );
}
