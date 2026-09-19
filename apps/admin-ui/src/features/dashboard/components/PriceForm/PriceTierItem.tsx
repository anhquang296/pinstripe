import RenderNumberField from '@common/components/FormField/RenderNumberField';
import type { PriceFormData } from '@common/forms/price-form';
import { Button, Card } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface PriceTierItemProps {
  form: UseFormReturn<PriceFormData>;
  index: number;
  onRemove: (index: number) => void;
}

export default function PriceTierItem({ form, index, onRemove }: PriceTierItemProps) {
  const handleOnRemove = () => {
    onRemove(index);
  };

  return (
    <Card className="gap-4 p-3">
      <span className="text-app-label text-[13px] font-medium">Bậc {index + 1}</span>
      <RenderNumberField
        control={form.control}
        name={`tiers.${index}.upTo`}
        label="Đến mức"
        minValue={1}
      />
      <RenderNumberField
        control={form.control}
        name={`tiers.${index}.unitAmount`}
        label="Đơn giá"
        minValue={0}
      />
      <RenderNumberField
        control={form.control}
        name={`tiers.${index}.flatAmount`}
        label="Phí cố định"
        minValue={0}
      />
      <Button type="button" variant="ghost" onPress={handleOnRemove}>
        Xóa bậc
      </Button>
    </Card>
  );
}
