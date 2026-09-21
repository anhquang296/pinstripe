import RenderCheckboxField from '@common/components/FormField/RenderCheckboxField';
import RenderNumberField from '@common/components/FormField/RenderNumberField';
import RenderSelectField from '@common/components/FormField/RenderSelectField';
import RenderTextField from '@common/components/FormField/RenderTextField';
import type { PaymentLinkFormData } from '@common/forms/payment-link-form';
import { Button } from '@heroui/react';
import { CheckoutSessionModeEnum } from '@vxrerp/core/contracts';
import type { UseFormReturn } from 'react-hook-form';

const MODE_OPTIONS = [
  { value: CheckoutSessionModeEnum.PAYMENT, label: 'payment — thu một lần' },
  { value: CheckoutSessionModeEnum.SUBSCRIPTION, label: 'subscription — mở thuê bao' },
  { value: CheckoutSessionModeEnum.SETUP, label: 'setup — lưu phương thức' },
];

interface PaymentLinkFormProps {
  mode: 'create' | 'edit';
  form: UseFormReturn<PaymentLinkFormData>;
  priceOptions: { value: string; label: string }[];
  isSaving?: boolean;
  onSave: () => void;
}

export default function PaymentLinkForm({
  mode,
  form,
  priceOptions,
  isSaving,
  onSave,
}: PaymentLinkFormProps) {
  const isEdit = mode === 'edit';

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
        name="mode"
        label="Chế độ"
        options={MODE_OPTIONS}
        isDisabled={isEdit}
      />
      <RenderTextField
        control={form.control}
        name="successUrl"
        label="URL thành công"
        placeholder="https://vexere.com/thanh-cong"
      />
      <RenderSelectField
        control={form.control}
        name="priceId"
        label="Bảng giá"
        options={priceOptions}
        isDisabled={isEdit}
      />
      <RenderNumberField
        control={form.control}
        name="quantity"
        label="Số lượng"
        minValue={1}
        isDisabled={isEdit}
      />
      {isEdit ? (
        <RenderCheckboxField control={form.control} name="isActive" label="Đang mở" />
      ) : null}
      <Button type="submit" isDisabled={isSaving}>
        {isEdit ? 'Lưu thay đổi' : 'Tạo payment link'}
      </Button>
    </form>
  );
}
