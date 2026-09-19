import RenderCheckboxGroupField from '@common/components/FormField/RenderCheckboxGroupField';
import RenderSelectField from '@common/components/FormField/RenderSelectField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { WebhookEndpointFormData } from '@common/forms/webhook-endpoint-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

import { EVENT_OPTIONS, STATUS_OPTIONS } from './constants';

interface WebhookEndpointFormProps {
  mode: 'create' | 'edit';
  form: UseFormReturn<WebhookEndpointFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function WebhookEndpointForm({
  mode,
  form,
  isSaving,
  onSave,
}: WebhookEndpointFormProps) {
  const isEdit = mode === 'edit';

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="flex flex-col gap-4">
        <RenderTextField
          control={form.control}
          name="url"
          label="URL nhận event"
          placeholder="http://localhost:4100/hooks"
          isDisabled={isEdit}
        />
        <RenderTextField
          control={form.control}
          name="description"
          label="Mô tả"
          placeholder="Hệ thống kế toán"
        />
        {isEdit ? (
          <RenderSelectField
            control={form.control}
            name="status"
            label="Trạng thái"
            options={STATUS_OPTIONS}
          />
        ) : null}
      </div>

      <RenderCheckboxGroupField
        control={form.control}
        name="enabledEvents"
        label="Event đăng ký"
        options={EVENT_OPTIONS}
      />

      <div>
        <Button type="submit" isDisabled={isSaving}>
          {isEdit ? 'Lưu thay đổi' : 'Đăng ký endpoint'}
        </Button>
      </div>
    </form>
  );
}
