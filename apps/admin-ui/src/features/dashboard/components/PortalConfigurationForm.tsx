import RenderCheckboxField from '@common/components/FormField/RenderCheckboxField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { PortalConfigurationFormData } from '@common/forms/portal-configuration-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface PortalConfigurationFormProps {
  mode: 'create' | 'edit';
  form: UseFormReturn<PortalConfigurationFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function PortalConfigurationForm({
  mode,
  form,
  isSaving,
  onSave,
}: PortalConfigurationFormProps) {
  const isEdit = mode === 'edit';

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
        name="businessName"
        label="Tên hiển thị"
        placeholder="Vexere"
      />
      <RenderTextField
        control={form.control}
        name="defaultReturnUrl"
        label="URL quay lại"
        placeholder="https://vexere.com/tai-khoan"
      />
      <RenderCheckboxField control={form.control} name="isDefault" label="Đặt làm mặc định" />
      {isEdit ? (
        <RenderCheckboxField control={form.control} name="isActive" label="Đang bật" />
      ) : null}
      <RenderCheckboxField
        control={form.control}
        name="canViewInvoiceHistory"
        label="Xem lịch sử hoá đơn"
      />
      <RenderCheckboxField
        control={form.control}
        name="canUpdatePaymentMethod"
        label="Đổi phương thức thanh toán"
      />
      <RenderCheckboxField
        control={form.control}
        name="canCancelSubscription"
        label="Tự hủy thuê bao"
      />
      <Button type="submit" isDisabled={isSaving}>
        {isEdit ? 'Lưu thay đổi' : 'Tạo cấu hình'}
      </Button>
    </form>
  );
}
