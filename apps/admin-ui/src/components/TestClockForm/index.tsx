import RenderDateField from '@components/fields/RenderDateField';
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
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderTextField
        control={form.control}
        name="name"
        label="Tên đồng hồ"
        placeholder="Demo kế toán"
      />
      <RenderDateField control={form.control} name="frozenTime" label="Mốc bắt đầu" hasTime />
      <Button type="submit" isDisabled={isSaving}>
        Tạo test clock
      </Button>
    </form>
  );
}
