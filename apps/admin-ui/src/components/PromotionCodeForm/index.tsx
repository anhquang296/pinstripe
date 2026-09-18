import Button from '@components/ui/Button';
import SelectField from '@components/ui/SelectField';
import TextField from '@components/ui/TextField';
import type { PromotionCodeFormData } from '@forms/promotion-code-form';
import { toNumber } from '@lib/form-value';
import type { UseFormReturn } from 'react-hook-form';

const FIRST_TIME_OPTIONS = [
  { value: 'no', label: 'Không giới hạn lần mua' },
  { value: 'yes', label: 'Chỉ cho giao dịch đầu tiên' },
];

interface PromotionCodeFormProps {
  form: UseFormReturn<PromotionCodeFormData>;
  couponOptions: { value: string; label: string }[];
  isSaving?: boolean;
  onSave: () => void;
}

export default function PromotionCodeForm({
  form,
  couponOptions,
  isSaving,
  onSave,
}: PromotionCodeFormProps) {
  const { errors } = form.formState;

  return (
    <form
      className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <SelectField
        label="Coupon"
        options={couponOptions}
        error={errors.couponId?.message}
        {...form.register('couponId')}
      />
      <TextField
        label="Mã (để trống là sinh tự động)"
        placeholder="SPRING25"
        error={errors.code?.message}
        {...form.register('code')}
      />
      <TextField
        label="Giới hạn lượt dùng (0 = không giới hạn)"
        type="number"
        error={errors.maxRedemptions?.message}
        {...form.register('maxRedemptions', { setValueAs: toNumber })}
      />
      <TextField
        label="Hoá đơn tối thiểu (VND, 0 = không yêu cầu)"
        type="number"
        error={errors.minimumAmount?.message}
        {...form.register('minimumAmount', { setValueAs: toNumber })}
      />
      <SelectField
        label="Ràng buộc"
        options={FIRST_TIME_OPTIONS}
        error={errors.firstTimeTransaction?.message}
        {...form.register('firstTimeTransaction')}
      />
      <Button type="submit" disabled={isSaving}>
        Tạo promotion code
      </Button>
    </form>
  );
}
