import RenderCheckboxGroupField from '@components/fields/RenderCheckboxGroupField';
import RenderSelectField from '@components/fields/RenderSelectField';
import RenderTextField from '@components/fields/RenderTextField';
import type { WebhookEndpointFormData } from '@forms/webhook-endpoint-form';
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
      <div className="flex flex-wrap items-end gap-4">
        <RenderTextField
          control={form.control}
          name="url"
          label="URL nhận event"
          placeholder="http://localhost:4100/hooks"
          className="w-96"
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
