import RenderSelectField from '@common/components/FormField/RenderSelectField';
import type { CancelPaymentIntentFormData } from '@common/forms/cancel-payment-intent-form';
import { Button } from '@heroui/react';
import { PaymentCancellationReasonEnum } from '@vxrerp/billing/contracts';
import type { UseFormReturn } from 'react-hook-form';

const CANCELLATION_REASON_OPTIONS = [
  { value: PaymentCancellationReasonEnum.REQUESTED_BY_CUSTOMER, label: 'Khách yêu cầu' },
  { value: PaymentCancellationReasonEnum.DUPLICATE, label: 'Trùng giao dịch' },
  { value: PaymentCancellationReasonEnum.FRAUDULENT, label: 'Nghi gian lận' },
  { value: PaymentCancellationReasonEnum.ABANDONED, label: 'Khách bỏ dở' },
  { value: PaymentCancellationReasonEnum.FAILED_INVOICE, label: 'Hoá đơn thất bại' },
];

interface CancelPaymentIntentFormProps {
  form: UseFormReturn<CancelPaymentIntentFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function CancelPaymentIntentForm({
  form,
  isSaving,
  onSave,
}: CancelPaymentIntentFormProps) {
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
        name="cancellationReason"
        label="Lý do huỷ"
        options={CANCELLATION_REASON_OPTIONS}
      />
      <Button type="submit" variant="danger" isDisabled={isSaving}>
        Huỷ payment intent
      </Button>
    </form>
  );
}
