import RenderTextField from '@components/fields/RenderTextField';
import type { ReverseTransactionFormData } from '@forms/reverse-transaction-form';
import { Button } from '@heroui/react';
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
  return (
    <form className="flex flex-col gap-4" onSubmit={onSave}>
      <RenderTextField
        control={form.control}
        name="reason"
        label={`Lý do đảo ${transactionId}`}
        placeholder="Phát hành nhầm kỳ"
      />
      <Button type="submit" isDisabled={isSaving}>
        Xác nhận đảo
      </Button>
    </form>
  );
}
