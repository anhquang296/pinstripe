import Button from '@components/ui/Button';
import TextField from '@components/ui/TextField';
import type { PriceFormData } from '@forms/price-form';
import { toNullableNumber } from '@forms/price-form';
import { get } from 'lodash-es';
import type { UseFormReturn } from 'react-hook-form';

interface PriceTierItemProps {
  form: UseFormReturn<PriceFormData>;
  index: number;
  onRemove: (index: number) => void;
}

export default function PriceTierItem({ form, index, onRemove }: PriceTierItemProps) {
  const tierErrors = get(form.formState.errors.tiers, index);

  const handleOnRemove = () => {
    onRemove(index);
  };

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <span className="h-9 pt-2 text-sm font-medium text-slate-500">Bậc {index + 1}</span>
      <TextField
        label="Đến mức"
        type="number"
        min={1}
        placeholder="để trống = hết phần còn lại"
        className="w-52"
        error={get(tierErrors, 'upTo.message')}
        {...form.register(`tiers.${index}.upTo`, { setValueAs: toNullableNumber })}
      />
      <TextField
        label="Đơn giá"
        type="number"
        min={0}
        className="w-36"
        error={get(tierErrors, 'unitAmount.message')}
        {...form.register(`tiers.${index}.unitAmount`, { setValueAs: toNullableNumber })}
      />
      <TextField
        label="Phí cố định"
        type="number"
        min={0}
        className="w-36"
        error={get(tierErrors, 'flatAmount.message')}
        {...form.register(`tiers.${index}.flatAmount`, { setValueAs: toNullableNumber })}
      />
      <Button type="button" variant="ghost" onClick={handleOnRemove}>
        Xóa bậc
      </Button>
    </div>
  );
}
