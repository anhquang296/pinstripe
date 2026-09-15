import Button from '@components/ui/Button';
import TextField from '@components/ui/TextField';
import type { TestClockFormData } from '@forms/test-clock-form';
import type { UseFormReturn } from 'react-hook-form';

interface TestClockFormProps {
  form: UseFormReturn<TestClockFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function TestClockForm({ form, isSaving, onSave }: TestClockFormProps) {
  const { errors } = form.formState;

  return (
    <form
      className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={onSave}
    >
      <TextField
        label="Tên đồng hồ"
        placeholder="Demo kế toán"
        error={errors.name?.message}
        {...form.register('name')}
      />
      <Button type="submit" disabled={isSaving}>
        Tạo test clock
      </Button>
    </form>
  );
}
