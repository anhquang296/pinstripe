import RenderNumberField from '@components/fields/RenderNumberField';
import RenderSelectField from '@components/fields/RenderSelectField';
import { COLLECTION_METHOD_LABELS } from '@constants/collection-method';
import type { SubscriptionFormData } from '@forms/subscription-form';
import { Button } from '@heroui/react';
import { map } from 'lodash-es';
import type { UseFormReturn } from 'react-hook-form';

interface SubscriptionFormOption {
  value: string;
  label: string;
}

interface SubscriptionFormProps {
  form: UseFormReturn<SubscriptionFormData>;
  customerOptions: SubscriptionFormOption[];
  priceOptions: SubscriptionFormOption[];
  isSaving?: boolean;
  onSave: () => void;
}

const collectionMethodOptions: SubscriptionFormOption[] = map(
  COLLECTION_METHOD_LABELS,
  (label, value) => {
    return { value, label };
  },
);

export default function SubscriptionForm({
  form,
  customerOptions,
  priceOptions,
  isSaving,
  onSave,
}: SubscriptionFormProps) {
  return (
    <form className="flex flex-col gap-4" onSubmit={onSave}>
      <RenderSelectField
        control={form.control}
        name="customerId"
        label="Khách hàng"
        options={customerOptions}
      />
      <RenderSelectField
        control={form.control}
        name="priceId"
        label="Bảng giá"
        options={priceOptions}
      />
      <RenderSelectField
        control={form.control}
        name="collectionMethod"
        label="Cách thu tiền"
        options={collectionMethodOptions}
      />
      <RenderNumberField
        control={form.control}
        name="trialPeriodDays"
        label="Trial (ngày)"
        minValue={0}
      />
      <Button type="submit" isDisabled={isSaving}>
        Tạo subscription
      </Button>
    </form>
  );
}
