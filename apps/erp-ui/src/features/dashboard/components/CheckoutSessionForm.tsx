import RenderNumberField from '@common/components/FormField/RenderNumberField';
import RenderSelectField from '@common/components/FormField/RenderSelectField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { CheckoutSessionFormData } from '@common/forms/checkout-session-form';
import { Button } from '@heroui/react';
import { CheckoutSessionModeEnum } from '@vxrerp/core/contracts';
import type { UseFormReturn } from 'react-hook-form';

const MODE_OPTIONS = [
  { value: CheckoutSessionModeEnum.PAYMENT, label: 'payment — thu một lần' },
  { value: CheckoutSessionModeEnum.SUBSCRIPTION, label: 'subscription — mở thuê bao' },
  { value: CheckoutSessionModeEnum.SETUP, label: 'setup — lưu phương thức' },
];

interface CheckoutSessionFormProps {
  form: UseFormReturn<CheckoutSessionFormData>;
  customerOptions: { value: string; label: string }[];
  priceOptions: { value: string; label: string }[];
  isSaving?: boolean;
  onSave: () => void;
}

export default function CheckoutSessionForm({
  form,
  customerOptions,
  priceOptions,
  isSaving,
  onSave,
}: CheckoutSessionFormProps) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <RenderSelectField control={form.control} name="mode" label="Chế độ" options={MODE_OPTIONS} />
      <RenderSelectField
        control={form.control}
        name="customerId"
        label="Khách hàng"
        options={customerOptions}
      />
      <RenderTextField
        control={form.control}
        name="successUrl"
        label="URL thành công"
        placeholder="https://vexere.com/thanh-cong"
      />
      <RenderTextField
        control={form.control}
        name="cancelUrl"
        label="URL huỷ"
        placeholder="https://vexere.com/huy"
      />
      <RenderSelectField
        control={form.control}
        name="priceId"
        label="Bảng giá"
        options={priceOptions}
      />
      <RenderNumberField control={form.control} name="quantity" label="Số lượng" minValue={1} />
      <Button type="submit" isDisabled={isSaving}>
        Tạo phiên checkout
      </Button>
    </form>
  );
}
