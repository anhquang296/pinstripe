import Button from '@components/ui/Button';
import SelectField from '@components/ui/SelectField';
import TextField from '@components/ui/TextField';
import type { SubscriptionFormData } from '@forms/subscription-form';
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

export default function SubscriptionForm({
  form,
  customerOptions,
  priceOptions,
  isSaving,
  onSave,
}: SubscriptionFormProps) {
  const { errors } = form.formState;

  return (
    <form
      className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={onSave}
    >
      <SelectField
        label="Khách hàng"
        options={customerOptions}
        error={errors.customerId?.message}
        {...form.register('customerId')}
      />
      <SelectField
        label="Bảng giá"
        options={priceOptions}
        error={errors.priceId?.message}
        {...form.register('priceId')}
      />
      <TextField
        label="Trial (ngày)"
        type="number"
        min={0}
        className="w-28"
        error={errors.trialPeriodDays?.message}
        {...form.register('trialPeriodDays', { valueAsNumber: true })}
      />
      <Button type="submit" disabled={isSaving}>
        Tạo subscription
      </Button>
    </form>
  );
}
