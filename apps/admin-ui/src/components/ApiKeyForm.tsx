import RenderCheckboxGroupField from '@components/fields/RenderCheckboxGroupField';
import RenderSelectField from '@components/fields/RenderSelectField';
import RenderTextField from '@components/fields/RenderTextField';
import type { ApiKeyFormData } from '@forms/api-key-form';
import { Button } from '@heroui/react';
import { ApiKeyScopeEnum, ApiKeyTypeEnum } from '@pinstripe/core/contracts';
import type { UseFormReturn } from 'react-hook-form';

const TYPE_OPTIONS = [
  { value: ApiKeyTypeEnum.SECRET, label: 'secret — server gọi server' },
  { value: ApiKeyTypeEnum.RESTRICTED, label: 'restricted — giới hạn theo scope' },
  { value: ApiKeyTypeEnum.PUBLISHABLE, label: 'publishable — nhúng ra client' },
];

const SCOPE_OPTIONS = [
  { value: ApiKeyScopeEnum.V1, label: 'v1 — API sản phẩm' },
  { value: ApiKeyScopeEnum.ADMIN, label: 'admin — bề mặt quản trị' },
  { value: ApiKeyScopeEnum.SYSTEM, label: 'system — bên thứ ba gọi vào' },
  { value: ApiKeyScopeEnum.MANAGEMENT, label: 'management — script vận hành' },
  { value: ApiKeyScopeEnum.PORTAL, label: 'portal — cổng khách hàng' },
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
      <div className="flex flex-wrap items-end gap-4">
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
      </div>

      <RenderCheckboxGroupField
        control={form.control}
        name="scopes"
        label="Scope"
        options={SCOPE_OPTIONS}
      />

      <div>
        <Button type="submit" isDisabled={isSaving}>
          Tạo API key
        </Button>
      </div>
    </form>
  );
}
