import RenderTextField from '@components/fields/RenderTextField';
import type { DiscountNoteFormData } from '@forms/discount-note-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface DiscountNoteFormProps {
  form: UseFormReturn<DiscountNoteFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function DiscountNoteForm({ form, isSaving, onSave }: DiscountNoteFormProps) {
  return (
    <form
      className="flex flex-wrap items-end gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderTextField
        control={form.control}
        name="note"
        label="Ghi chú"
        placeholder="Ưu đãi theo hợp đồng khung"
      />
      <Button type="submit" isDisabled={isSaving}>
        Lưu ghi chú
      </Button>
    </form>
  );
}
