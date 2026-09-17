import Button from '@components/ui/Button';
import SelectField from '@components/ui/SelectField';
import TextField from '@components/ui/TextField';
import type { PriceFormData } from '@forms/price-form';
import { BillingSchemeEnum, PriceTypeEnum, UsageTypeEnum } from '@pinstripe/core/contracts';
import { get, map } from 'lodash-es';
import type { UseFormReturn } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';

import {
  BILLING_SCHEME_OPTIONS,
  CURRENCY_OPTIONS,
  INTERVAL_OPTIONS,
  PRICE_TYPE_OPTIONS,
  TIERS_MODE_OPTIONS,
  USAGE_TYPE_OPTIONS,
} from './constants';
import { toNullableNumber } from './helpers';
import PriceTierItem from './PriceTierItem';

interface PriceFormOption {
  value: string;
  label: string;
}

interface PriceFormProps {
  form: UseFormReturn<PriceFormData>;
  productOptions: PriceFormOption[];
  meterOptions: PriceFormOption[];
  isSaving?: boolean;
  onSave: () => void;
}

export default function PriceForm({
  form,
  productOptions,
  meterOptions,
  isSaving,
  onSave,
}: PriceFormProps) {
  const { errors } = form.formState;
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'tiers' });

  const priceType = form.watch('priceType');
  const usageType = form.watch('usageType');
  const billingScheme = form.watch('billingScheme');

  const isRecurring = priceType === PriceTypeEnum.RECURRING;
  const isMetered = isRecurring && usageType === UsageTypeEnum.METERED;
  const isTiered = billingScheme === BillingSchemeEnum.TIERED;
  const tiersError = get(errors.tiers, 'root.message', get(errors.tiers, 'message'));

  const handleOnAddTier = () => {
    append({ upTo: null, unitAmount: null, flatAmount: null });
  };

  return (
    <form
      className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={onSave}
    >
      <SelectField
        label="Product"
        options={productOptions}
        error={errors.productId?.message}
        {...form.register('productId')}
      />
      <TextField
        label="Lookup key"
        placeholder="pro_monthly_vnd"
        error={errors.lookupKey?.message}
        {...form.register('lookupKey')}
      />
      <SelectField
        label="Tiền tệ"
        options={CURRENCY_OPTIONS}
        className="min-w-28"
        error={errors.currency?.message}
        {...form.register('currency')}
      />
      <TextField
        label="Nickname"
        placeholder="Pro theo tháng"
        error={errors.nickname?.message}
        {...form.register('nickname')}
      />
      <TextField
        label="Hiệu lực từ"
        type="datetime-local"
        className="w-56"
        error={errors.effectiveAt?.message}
        {...form.register('effectiveAt')}
      />

      <SelectField
        label="Loại giá"
        options={PRICE_TYPE_OPTIONS}
        error={errors.priceType?.message}
        {...form.register('priceType')}
      />

      {isRecurring ? (
        <>
          <SelectField
            label="Chu kỳ"
            options={INTERVAL_OPTIONS}
            error={errors.interval?.message}
            {...form.register('interval')}
          />
          <TextField
            label="Số chu kỳ"
            type="number"
            min={1}
            className="w-28"
            error={errors.intervalCount?.message}
            {...form.register('intervalCount', { setValueAs: toNullableNumber })}
          />
          <SelectField
            label="Lượng dùng"
            options={USAGE_TYPE_OPTIONS}
            error={errors.usageType?.message}
            {...form.register('usageType')}
          />
        </>
      ) : null}

      {isMetered ? (
        <SelectField
          label="Meter"
          options={meterOptions}
          error={errors.meterId?.message}
          {...form.register('meterId')}
        />
      ) : null}

      <SelectField
        label="Cách tính giá"
        options={BILLING_SCHEME_OPTIONS}
        error={errors.billingScheme?.message}
        {...form.register('billingScheme')}
      />

      {isTiered ? (
        <SelectField
          label="Kiểu bậc"
          options={TIERS_MODE_OPTIONS}
          error={errors.tiersMode?.message}
          {...form.register('tiersMode')}
        />
      ) : (
        <TextField
          label="Đơn giá"
          type="number"
          min={0}
          placeholder="799000"
          className="w-36"
          error={errors.unitAmount?.message}
          {...form.register('unitAmount', { setValueAs: toNullableNumber })}
        />
      )}

      {isTiered ? (
        <div className="flex w-full flex-col gap-3">
          {map(fields, (field, index) => {
            return <PriceTierItem key={field.id} form={form} index={index} onRemove={remove} />;
          })}

          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={handleOnAddTier}>
              Thêm bậc
            </Button>
            <span className="text-xs text-slate-500">
              Bậc cuối để trống ô “Đến mức” để bắt hết phần còn lại.
            </span>
          </div>

          {tiersError ? <span className="text-xs text-red-600">{tiersError}</span> : null}
        </div>
      ) : null}

      <Button type="submit" disabled={isSaving}>
        Tạo price
      </Button>
    </form>
  );
}
