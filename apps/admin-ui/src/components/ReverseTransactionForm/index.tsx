import Button from '@components/ui/Button';
import TextField from '@components/ui/TextField';
import type { ReverseTransactionFormData } from '@forms/reverse-transaction-form';
import type { UseFormReturn } from 'react-hook-form';

interface ReverseTransactionFormProps {
  form: UseFormReturn<ReverseTransactionFormData>;
  transactionId: string;
  isSaving?: boolean;
  onSave: () => void;
}

export default function ReverseTransactionForm({
  form,
  transactionId,
  isSaving,
  onSave,
}: ReverseTransactionFormProps) {
  const { errors } = form.formState;

  return (
    <form
      className="flex flex-wrap items-end gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4"
      onSubmit={onSave}
    >
      <TextField
        label={`Lý do đảo ${transactionId}`}
        placeholder="Phát hành nhầm kỳ"
        error={errors.reason?.message}
        {...form.register('reason')}
      />
      <Button type="submit" disabled={isSaving}>
        Xác nhận đảo
      </Button>
    </form>
  );
}
