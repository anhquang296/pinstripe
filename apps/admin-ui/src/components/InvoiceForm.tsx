import RenderCheckboxField from '@components/fields/RenderCheckboxField';
import RenderNumberField from '@components/fields/RenderNumberField';
import RenderSelectField from '@components/fields/RenderSelectField';
import { COLLECTION_METHOD_LABELS } from '@constants/collection-method';
import type { InvoiceFormData } from '@forms/invoice-form';
import { Button } from '@heroui/react';
import { CollectionMethodEnum, CurrencyEnum } from '@pinstripe/core/contracts';
import { map, values } from 'lodash-es';
import type { UseFormReturn } from 'react-hook-form';

const CURRENCY_OPTIONS = map(values(CurrencyEnum), (currency) => {
  return { value: currency, label: currency };
});

const COLLECTION_METHOD_OPTIONS = map(values(CollectionMethodEnum), (collectionMethod) => {
  return { value: collectionMethod, label: COLLECTION_METHOD_LABELS[collectionMethod] };
});

interface InvoiceFormProps {
  form: UseFormReturn<InvoiceFormData>;
  customerOptions: { value: string; label: string }[];
  subscriptionOptions: { value: string; label: string }[];
  isSaving?: boolean;
  onSave: () => void;
}

export default function InvoiceForm({
  form,
  customerOptions,
  subscriptionOptions,
  isSaving,
  onSave,
}: InvoiceFormProps) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="flex flex-col gap-4">
        <RenderSelectField
          control={form.control}
          name="customerId"
          label="Customer"
          options={customerOptions}
        />
        <RenderSelectField
          control={form.control}
          name="subscriptionId"
          label="Subscription"
          options={subscriptionOptions}
        />
        <RenderSelectField
          control={form.control}
          name="currency"
          label="Tiền tệ"
          options={CURRENCY_OPTIONS}
        />
      </div>

      <div className="flex flex-col gap-4">
        <RenderSelectField
          control={form.control}
          name="collectionMethod"
          label="Cách thu tiền"
          options={COLLECTION_METHOD_OPTIONS}
        />
        <RenderNumberField
          control={form.control}
          name="daysUntilDue"
          label="Hạn thanh toán (ngày)"
          minValue={0}
          maxValue={365}
        />
        <RenderCheckboxField control={form.control} name="autoAdvance" label="Tự động phát hành" />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" isDisabled={isSaving}>
          Tạo hoá đơn nháp
        </Button>
      </div>
    </form>
  );
}
