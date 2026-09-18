import Button from '@components/ui/Button';
import SelectField from '@components/ui/SelectField';
import TextField from '@components/ui/TextField';
import type { CouponFormData } from '@forms/coupon-form';
import { toNumber } from '@lib/form-value';
import { CouponDurationEnum } from '@pinstripe/core/contracts';
import type { UseFormReturn } from 'react-hook-form';

const KIND_OPTIONS = [
  { value: 'percent', label: 'percentOff — giảm theo phần trăm' },
  { value: 'amount', label: 'amountOff — giảm số tiền cố định' },
];

const DURATION_OPTIONS = [
  { value: CouponDurationEnum.ONCE, label: 'once — một hoá đơn' },
  { value: CouponDurationEnum.REPEATING, label: 'repeating — trong N tháng' },
  { value: CouponDurationEnum.FOREVER, label: 'forever — mãi mãi' },
];

interface CouponFormProps {
  form: UseFormReturn<CouponFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function CouponForm({ form, isSaving, onSave }: CouponFormProps) {
  const { errors } = form.formState;

  return (
    <form
      className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <TextField
        label="Tên"
        placeholder="Khai trương 20%"
        error={errors.name?.message}
        {...form.register('name')}
      />
      <SelectField
        label="Kiểu"
        options={KIND_OPTIONS}
        error={errors.kind?.message}
        {...form.register('kind')}
      />
      <TextField
        label="Phần trăm giảm"
        type="number"
        error={errors.percentOff?.message}
        {...form.register('percentOff', { setValueAs: toNumber })}
      />
      <TextField
        label="Số tiền giảm (VND)"
        type="number"
        error={errors.amountOff?.message}
        {...form.register('amountOff', { setValueAs: toNumber })}
      />
      <SelectField
        label="Thời hạn"
        options={DURATION_OPTIONS}
        error={errors.duration?.message}
        {...form.register('duration')}
      />
      <TextField
        label="Số tháng"
        type="number"
        error={errors.durationInMonths?.message}
        {...form.register('durationInMonths', { setValueAs: toNumber })}
      />
      <TextField
        label="Giới hạn lượt dùng (0 = không giới hạn)"
        type="number"
        error={errors.maxRedemptions?.message}
        {...form.register('maxRedemptions', { setValueAs: toNumber })}
      />
      <Button type="submit" disabled={isSaving}>
        Tạo coupon
      </Button>
    </form>
  );
}
