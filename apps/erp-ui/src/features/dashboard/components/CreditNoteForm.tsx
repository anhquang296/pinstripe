import RenderNumberField from '@common/components/FormField/RenderNumberField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { CreditNoteFormData } from '@common/forms/credit-note-form';
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
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderNumberField control={form.control} name="amount" label="Số tiền ghi có" minValue={1} />
      <RenderNumberField
        control={form.control}
        name="refundAmount"
        label="Trong đó hoàn tiền"
        minValue={0}
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
