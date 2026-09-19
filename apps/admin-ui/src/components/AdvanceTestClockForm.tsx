import RenderDateField from '@components/fields/RenderDateField';
import type { AdvanceTestClockFormData } from '@forms/advance-test-clock-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface AdvanceTestClockFormProps {
  form: UseFormReturn<AdvanceTestClockFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function AdvanceTestClockForm({
  form,
  isSaving,
  onSave,
}: AdvanceTestClockFormProps) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderDateField control={form.control} name="frozenTime" label="Tua tới" hasTime />
      <Button type="submit" isDisabled={isSaving}>
        Tua đồng hồ
      </Button>
    </form>
  );
}
