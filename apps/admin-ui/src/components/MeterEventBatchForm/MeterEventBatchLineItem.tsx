import RenderNumberField from '@components/fields/RenderNumberField';
import RenderSelectField from '@components/fields/RenderSelectField';
import type { MeterEventBatchFormData } from '@forms/meter-event-batch-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface MeterEventBatchLineItemProps {
  form: UseFormReturn<MeterEventBatchFormData>;
  index: number;
  customerOptions: { value: string; label: string }[];
  onRemove: (index: number) => void;
}

export default function MeterEventBatchLineItem({
  form,
  index,
  customerOptions,
  onRemove,
}: MeterEventBatchLineItemProps) {
  const handleOnRemove = () => {
    onRemove(index);
  };

  return (
    <div className="border-app-border-soft flex flex-wrap items-end gap-4 rounded-md border bg-background p-3">
      <RenderSelectField
        control={form.control}
        name={`lines.${index}.customerId`}
        label="Khách hàng"
        options={customerOptions}
      />
      <RenderNumberField
        control={form.control}
        name={`lines.${index}.value`}
        label="Giá trị"
        minValue={0}
        className="w-32"
      />
      <Button type="button" variant="ghost" onPress={handleOnRemove}>
        Xoá dòng
      </Button>
    </div>
  );
}
