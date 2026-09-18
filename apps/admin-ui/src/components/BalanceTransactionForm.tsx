import RenderNumberField from '@components/fields/RenderNumberField';
import RenderTextField from '@components/fields/RenderTextField';
import type { BalanceTransactionFormData } from '@forms/balance-transaction-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface BalanceTransactionFormProps {
  form: UseFormReturn<BalanceTransactionFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function BalanceTransactionForm({
  form,
  isSaving,
  onSave,
}: BalanceTransactionFormProps) {
  return (
    <form
      className="flex flex-wrap items-end gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderNumberField
        control={form.control}
        name="amount"
        label="Số tiền (âm là ghi nợ khách)"
        className="w-52"
      />
      <RenderTextField
        control={form.control}
        name="description"
        label="Diễn giải"
        placeholder="Bù trừ khiếu nại"
      />
      <Button type="submit" isDisabled={isSaving}>
        Ghi bút toán
      </Button>
    </form>
  );
}
