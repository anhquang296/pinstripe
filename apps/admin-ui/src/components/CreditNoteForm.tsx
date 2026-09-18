import RenderNumberField from '@components/fields/RenderNumberField';
import RenderTextField from '@components/fields/RenderTextField';
import type { CreditNoteFormData } from '@forms/credit-note-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface CreditNoteFormProps {
  form: UseFormReturn<CreditNoteFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function CreditNoteForm({ form, isSaving, onSave }: CreditNoteFormProps) {
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
        label="Số tiền ghi có"
        minValue={1}
        className="w-40"
      />
      <RenderNumberField
        control={form.control}
        name="refundAmount"
        label="Trong đó hoàn tiền"
        minValue={0}
        className="w-40"
      />
      <RenderTextField
        control={form.control}
        name="description"
        label="Diễn giải"
        placeholder="Điều chỉnh dòng dịch vụ"
      />
      <RenderTextField
        control={form.control}
        name="reason"
        label="Lý do"
        placeholder="Khách khiếu nại"
      />
      <Button type="submit" isDisabled={isSaving}>
        Tạo credit note
      </Button>
    </form>
  );
}
