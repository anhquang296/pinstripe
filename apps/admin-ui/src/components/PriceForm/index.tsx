import RenderDateField from '@components/fields/RenderDateField';
import RenderNumberField from '@components/fields/RenderNumberField';
import RenderSelectField from '@components/fields/RenderSelectField';
import RenderTextField from '@components/fields/RenderTextField';
import type { PriceFormData } from '@forms/price-form';
import { Button } from '@heroui/react';
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
  const tiersArrayError = get(errors.tiers, 'message');
  const tiersError = get(errors.tiers, 'root.message', tiersArrayError);

  const handleOnAddTier = () => {
    append({ upTo: null, unitAmount: null, flatAmount: null });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={onSave}>
      <RenderSelectField
        control={form.control}
        name="productId"
        label="Product"
        options={productOptions}
      />
      <RenderTextField
        control={form.control}
        name="lookupKey"
        label="Lookup key"
        placeholder="pro_monthly_vnd"
      />
      <RenderSelectField
        control={form.control}
        name="currency"
        label="Tiền tệ"
        options={CURRENCY_OPTIONS}
      />
      <RenderTextField
        control={form.control}
        name="nickname"
        label="Nickname"
        placeholder="Pro theo tháng"
      />
      <RenderDateField control={form.control} name="effectiveAt" label="Hiệu lực từ" hasTime />

      <RenderSelectField
        control={form.control}
        name="priceType"
        label="Loại giá"
        options={PRICE_TYPE_OPTIONS}
      />

      {isRecurring ? (
        <>
          <RenderSelectField
            control={form.control}
            name="interval"
            label="Chu kỳ"
            options={INTERVAL_OPTIONS}
          />
          <RenderNumberField
            control={form.control}
            name="intervalCount"
            label="Số chu kỳ"
            minValue={1}
          />
          <RenderSelectField
            control={form.control}
            name="usageType"
            label="Lượng dùng"
            options={USAGE_TYPE_OPTIONS}
          />
        </>
      ) : null}

      {isMetered ? (
        <RenderSelectField
          control={form.control}
          name="meterId"
          label="Meter"
          options={meterOptions}
        />
      ) : null}

      <RenderSelectField
        control={form.control}
        name="billingScheme"
        label="Cách tính giá"
        options={BILLING_SCHEME_OPTIONS}
      />

      {isTiered ? (
        <RenderSelectField
          control={form.control}
          name="tiersMode"
          label="Kiểu bậc"
          options={TIERS_MODE_OPTIONS}
        />
      ) : (
        <RenderNumberField control={form.control} name="unitAmount" label="Đơn giá" minValue={0} />
      )}

      {isTiered ? (
        <div className="flex w-full flex-col gap-3">
          {map(fields, (field, index) => {
            return <PriceTierItem key={field.id} form={form} index={index} onRemove={remove} />;
          })}

          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onPress={handleOnAddTier}>
              Thêm bậc
            </Button>
            <span className="text-[12px] text-muted">
              Bậc cuối để trống ô “Đến mức” để bắt hết phần còn lại.
            </span>
          </div>

          {tiersError ? <span className="text-[12px] text-danger">{tiersError}</span> : null}
        </div>
      ) : null}

      <Button type="submit" isDisabled={isSaving}>
        Tạo price
      </Button>
    </form>
  );
}
