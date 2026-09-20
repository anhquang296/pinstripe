import type { MeterEventBatchFormData } from '@common/forms/meter-event-batch-form';
import { Button } from '@heroui/react';
import { get, map } from 'lodash-es';
import type { UseFormReturn } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';

import MeterEventBatchLineItem from './MeterEventBatchLineItem';

interface MeterEventBatchFormProps {
  form: UseFormReturn<MeterEventBatchFormData>;
  customerOptions: { value: string; label: string }[];
  isSaving?: boolean;
  onSave: () => void;
}

export default function MeterEventBatchForm({
  form,
  customerOptions,
  isSaving,
  onSave,
}: MeterEventBatchFormProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });

  const linesError = get(form.formState.errors.lines, 'root.message');

  const handleOnAddLine = () => {
    append({ customerId: '', value: 1 });
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      {map(fields, (field, index) => {
        return (
          <MeterEventBatchLineItem
            key={field.id}
            form={form}
            index={index}
            customerOptions={customerOptions}
            onRemove={remove}
          />
        );
      })}

      {linesError ? <span className="text-[12px] text-danger">{linesError}</span> : null}

      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" onPress={handleOnAddLine}>
          Thêm dòng
        </Button>
        <Button type="submit" isDisabled={isSaving}>
          Gửi batch
        </Button>
      </div>
    </form>
  );
}
