import RenderCheckboxField from '@common/components/FormField/RenderCheckboxField';
import RenderSelectField from '@common/components/FormField/RenderSelectField';
import { COLLECTION_METHOD_LABELS } from '@common/constants/collection-method';
import type { SubscriptionUpdateFormData } from '@common/forms/subscription-update-form';
import { Button } from '@heroui/react';
import { ProrationBehaviorEnum } from '@vxrerp/billing/contracts';
import { map } from 'lodash-es';
import type { UseFormReturn } from 'react-hook-form';

const PRORATION_OPTIONS = [
  { value: ProrationBehaviorEnum.CREATE_PRORATIONS, label: 'create_prorations — chia tiền lẻ kỳ' },
  { value: ProrationBehaviorEnum.NONE, label: 'none — không chia' },
  { value: ProrationBehaviorEnum.ALWAYS_INVOICE, label: 'always_invoice — xuất hoá đơn ngay' },
];

const COLLECTION_METHOD_OPTIONS = map(COLLECTION_METHOD_LABELS, (label, value) => {
  return { value, label };
});

interface SubscriptionUpdateFormProps {
  form: UseFormReturn<SubscriptionUpdateFormData>;
  isSaving?: boolean;
  onSave: () => void;
}

export default function SubscriptionUpdateForm({
  form,
  isSaving,
  onSave,
}: SubscriptionUpdateFormProps) {
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
        name="collectionMethod"
        label="Cách thu tiền"
        options={COLLECTION_METHOD_OPTIONS}
      />
      <RenderSelectField
        control={form.control}
        name="prorationBehavior"
        label="Chia tiền lẻ kỳ"
        options={PRORATION_OPTIONS}
      />
      <RenderCheckboxField
        control={form.control}
        name="cancelAtPeriodEnd"
        label="Hủy vào cuối kỳ"
      />
      <Button type="submit" isDisabled={isSaving}>
        Lưu thay đổi
      </Button>
    </form>
  );
}
