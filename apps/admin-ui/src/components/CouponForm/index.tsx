import RenderNumberField from '@components/fields/RenderNumberField';
import RenderSelectField from '@components/fields/RenderSelectField';
import RenderTextField from '@components/fields/RenderTextField';
import type { CouponFormData } from '@forms/coupon-form';
import { Button } from '@heroui/react';
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
  mode: 'create' | 'edit';
  form: UseFormReturn<CouponFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function CouponForm({ mode, form, isSaving, onSave }: CouponFormProps) {
  return (
    <form
      className="border-app-border-soft flex flex-wrap items-end gap-4 rounded-md border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderTextField
        control={form.control}
        name="name"
        label="Tên"
        placeholder="Khai trương 20%"
      />
      <RenderSelectField
        control={form.control}
        name="kind"
        label="Kiểu"
        options={KIND_OPTIONS}
        isDisabled={mode === 'edit'}
      />
      <RenderNumberField
        control={form.control}
        name="percentOff"
        label="Phần trăm giảm"
        minValue={0}
        maxValue={100}
        isDisabled={mode === 'edit'}
      />
      <RenderNumberField
        control={form.control}
        name="amountOff"
        label="Số tiền giảm (VND)"
        minValue={0}
        isDisabled={mode === 'edit'}
      />
      <RenderSelectField
        control={form.control}
        name="duration"
        label="Thời hạn"
        options={DURATION_OPTIONS}
        isDisabled={mode === 'edit'}
      />
      <RenderNumberField
        control={form.control}
        name="durationInMonths"
        label="Số tháng"
        minValue={0}
        isDisabled={mode === 'edit'}
      />
      <RenderNumberField
        control={form.control}
        name="maxRedemptions"
        label="Giới hạn lượt dùng (0 = không giới hạn)"
        minValue={0}
        isDisabled={mode === 'edit'}
      />
      <Button type="submit" isDisabled={isSaving}>
        {mode === 'create' ? 'Tạo coupon' : 'Lưu thay đổi'}
      </Button>
    </form>
  );
}
