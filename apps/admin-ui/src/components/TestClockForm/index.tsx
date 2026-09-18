import RenderTextField from '@components/fields/RenderTextField';
import type { TestClockFormData } from '@forms/test-clock-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface TestClockFormProps {
  form: UseFormReturn<TestClockFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function TestClockForm({ form, isSaving, onSave }: TestClockFormProps) {
  return (
    <form
      className="border-app-border-soft flex flex-wrap items-end gap-4 rounded-md border bg-surface p-4"
      onSubmit={onSave}
    >
      <RenderTextField
        control={form.control}
        name="name"
        label="Tên đồng hồ"
        placeholder="Demo kế toán"
      />
      <Button type="submit" isDisabled={isSaving}>
        Tạo test clock
      </Button>
    </form>
  );
}
