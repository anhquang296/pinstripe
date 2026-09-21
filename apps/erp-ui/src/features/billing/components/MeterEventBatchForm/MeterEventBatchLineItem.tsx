import RenderNumberField from '@common/components/FormField/RenderNumberField';
import RenderSelectField from '@common/components/FormField/RenderSelectField';
import type { MeterEventBatchFormData } from '@common/forms/meter-event-batch-form';
import { Button, Card } from '@heroui/react';
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
    <Card className="gap-4 p-3">
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
      />
      <Button type="button" variant="ghost" onPress={handleOnRemove}>
        Xoá dòng
      </Button>
    </Card>
  );
}
