import RenderCheckboxGroupField from '@common/components/FormField/RenderCheckboxGroupField';
import RenderSelectField from '@common/components/FormField/RenderSelectField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { ApiKeyFormData } from '@common/forms/api-key-form';
import { Button } from '@heroui/react';
import { ApiKeyTypeEnum, PermissionEnum } from '@vxrerp/platform/contracts';
import type { UseFormReturn } from 'react-hook-form';

const TYPE_OPTIONS = [
  { value: ApiKeyTypeEnum.SECRET, label: 'secret — server gọi server' },
  { value: ApiKeyTypeEnum.RESTRICTED, label: 'restricted — giới hạn theo quyền' },
  { value: ApiKeyTypeEnum.PUBLISHABLE, label: 'publishable — nhúng ra client' },
];

const PERMISSION_OPTIONS = [
  { value: PermissionEnum.BILLING_READ, label: 'billing.read — đọc mọi dữ liệu billing' },
  { value: PermissionEnum.CUSTOMER_WRITE, label: 'customer.write — tạo và sửa khách hàng' },
  { value: PermissionEnum.CUSTOMER_DELETE, label: 'customer.delete — xoá khách hàng' },
  { value: PermissionEnum.CATALOG_WRITE, label: 'catalog.write — sản phẩm, giá, thuế, giảm giá' },
  { value: PermissionEnum.SUBSCRIPTION_WRITE, label: 'subscription.write — gói thuê bao' },
  { value: PermissionEnum.INVOICE_WRITE, label: 'invoice.write — tạo và phát hành hoá đơn' },
  { value: PermissionEnum.INVOICE_VOID, label: 'invoice.void — huỷ hoá đơn đã phát hành' },
  { value: PermissionEnum.CREDIT_NOTE_WRITE, label: 'credit_note.write — giấy báo có' },
  { value: PermissionEnum.REFUND_WRITE, label: 'refund.write — thanh toán và hoàn tiền' },
  { value: PermissionEnum.LEDGER_WRITE, label: 'ledger.write — ghi bút toán sổ cái' },
  { value: PermissionEnum.INTEGRATION_WRITE, label: 'integration.write — webhook endpoint' },
  { value: PermissionEnum.TEST_CLOCK_WRITE, label: 'test_clock.write — test clock' },
  { value: PermissionEnum.API_KEY_MANAGE, label: 'api_key.manage — quản lý API key' },
  { value: PermissionEnum.USER_MANAGE, label: 'user.manage — quản lý người dùng' },
  { value: PermissionEnum.PORTAL_WRITE, label: 'portal.write — mở phiên cổng khách hàng' },
];

interface ApiKeyFormProps {
  form: UseFormReturn<ApiKeyFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function ApiKeyForm({ form, isSaving, onSave }: ApiKeyFormProps) {
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
        name="name"
        label="Tên khoá"
        placeholder="Worker đối soát"
      />
      <RenderSelectField
        control={form.control}
        name="type"
        label="Loại khoá"
        options={TYPE_OPTIONS}
      />

      <RenderCheckboxGroupField
        control={form.control}
        name="permissions"
        label="Quyền"
        options={PERMISSION_OPTIONS}
      />

      <div>
        <Button type="submit" isDisabled={isSaving}>
          Tạo API key
        </Button>
      </div>
    </form>
  );
}
