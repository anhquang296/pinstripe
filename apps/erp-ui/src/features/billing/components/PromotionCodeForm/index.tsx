import RenderNumberField from '@common/components/FormField/RenderNumberField';
import RenderSelectField from '@common/components/FormField/RenderSelectField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { PromotionCodeFormData } from '@common/forms/promotion-code-form';
import { Button } from '@heroui/react';
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
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderSelectField
        control={form.control}
        name="couponId"
        label="Coupon"
        options={couponOptions}
      />
      <RenderTextField
        control={form.control}
        name="code"
        label="Mã (để trống là sinh tự động)"
        placeholder="SPRING25"
      />
      <RenderNumberField
        control={form.control}
        name="maxRedemptions"
        label="Giới hạn lượt dùng (0 = không giới hạn)"
        minValue={0}
      />
      <RenderNumberField
        control={form.control}
        name="minimumAmount"
        label="Hoá đơn tối thiểu (VND, 0 = không yêu cầu)"
        minValue={0}
      />
      <RenderSelectField
        control={form.control}
        name="firstTimeTransaction"
        label="Ràng buộc"
        options={FIRST_TIME_OPTIONS}
      />
      <Button type="submit" isDisabled={isSaving}>
        Tạo promotion code
      </Button>
    </form>
  );
}
