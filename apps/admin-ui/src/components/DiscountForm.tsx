import RenderSelectField from '@components/fields/RenderSelectField';
import RenderTextField from '@components/fields/RenderTextField';
import type { DiscountFormData } from '@forms/discount-form';
import { Button } from '@heroui/react';
import type { UseFormReturn } from 'react-hook-form';

interface DiscountFormProps {
  form: UseFormReturn<DiscountFormData>;
  couponOptions: { value: string; label: string }[];
  customerOptions: { value: string; label: string }[];
  subscriptionOptions: { value: string; label: string }[];
  isSaving?: boolean;
  onSave: () => void;
}

export default function DiscountForm({
  form,
  couponOptions,
  customerOptions,
  subscriptionOptions,
  isSaving,
  onSave,
}: DiscountFormProps) {
  return (
    <form
      className="flex flex-wrap items-end gap-4"
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
        name="promotionCode"
        label="Mã khuyến mãi"
        placeholder="SPRING25"
      />
      <RenderSelectField
        control={form.control}
        name="customerId"
        label="Khách hàng"
        options={customerOptions}
      />
      <RenderSelectField
        control={form.control}
        name="subscriptionId"
        label="Subscription"
        options={subscriptionOptions}
      />
      <Button type="submit" isDisabled={isSaving}>
        Áp giảm giá
      </Button>
    </form>
  );
}
