import RenderNumberField from '@components/fields/RenderNumberField';
import type { PriceFormData } from '@forms/price-form';
import { Button } from '@heroui/react';
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
    <div className="border-app-border-soft flex flex-wrap items-end gap-4 rounded-md border bg-background p-3">
      <span className="text-app-label h-control pt-2 text-[13px] font-medium">Bậc {index + 1}</span>
      <RenderNumberField
        control={form.control}
        name={`tiers.${index}.upTo`}
        label="Đến mức"
        minValue={1}
        className="w-52"
      />
      <RenderNumberField
        control={form.control}
        name={`tiers.${index}.unitAmount`}
        label="Đơn giá"
        minValue={0}
        className="w-36"
      />
      <RenderNumberField
        control={form.control}
        name={`tiers.${index}.flatAmount`}
        label="Phí cố định"
        minValue={0}
        className="w-36"
      />
      <Button type="button" variant="ghost" onPress={handleOnRemove}>
        Xóa bậc
      </Button>
    </div>
  );
}
