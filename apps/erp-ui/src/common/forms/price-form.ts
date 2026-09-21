import { zodResolver } from '@hookform/resolvers/zod';
import {
  BillingSchemeEnum,
  CurrencyEnum,
  PriceTypeEnum,
  RecurringIntervalEnum,
  TiersModeEnum,
  UsageTypeEnum,
} from '@vxrerp/core/contracts';
import type { CreatePricePayload } from '@vxrerp/sdk';
import { last, map, size } from 'lodash-es';
import { z } from 'zod';

const MAX_INTERVAL_COUNT = 52;

type PriceTierPayload = NonNullable<CreatePricePayload['tiers']>[number];

const priceTierFormSchema = z.object({
  upTo: z
    .number({ message: 'Ngưỡng phải là số' })
    .int('Ngưỡng phải là số nguyên')
    .min(1, 'Ngưỡng phải lớn hơn 0')
    .nullable(),
  unitAmount: z
    .number({ message: 'Đơn giá phải là số' })
    .int('Đơn giá phải là số nguyên')
    .min(0, 'Đơn giá không được âm')
    .nullable(),
  flatAmount: z
    .number({ message: 'Phí cố định phải là số' })
    .int('Phí cố định phải là số nguyên')
    .min(0, 'Phí cố định không được âm')
    .nullable(),
});

const priceFormSchema = z
  .object({
    productId: z.string().min(1, 'Chọn product'),
    lookupKey: z.string(),
    currency: z.nativeEnum(CurrencyEnum, { message: 'Chọn một loại tiền tệ' }),
    nickname: z.string(),
    effectiveAt: z.string(),
    priceType: z.nativeEnum(PriceTypeEnum, { message: 'Chọn loại giá' }),
    interval: z.nativeEnum(RecurringIntervalEnum, { message: 'Chọn chu kỳ' }),
    intervalCount: z
      .number({ message: 'Số chu kỳ phải là số' })
      .int('Số chu kỳ phải là số nguyên')
      .min(1, 'Số chu kỳ tối thiểu là 1')
      .max(MAX_INTERVAL_COUNT, `Số chu kỳ tối đa là ${MAX_INTERVAL_COUNT}`)
      .nullable(),
    usageType: z.nativeEnum(UsageTypeEnum, { message: 'Chọn cách tính lượng dùng' }),
    meterId: z.string(),
    billingScheme: z.nativeEnum(BillingSchemeEnum, { message: 'Chọn cách tính giá' }),
    unitAmount: z
      .number({ message: 'Đơn giá phải là số' })
      .int('Đơn giá phải là số nguyên')
      .min(0, 'Đơn giá không được âm')
      .nullable(),
    tiersMode: z.nativeEnum(TiersModeEnum, { message: 'Chọn kiểu bậc' }),
    tiers: z.array(priceTierFormSchema),
  })
  .superRefine((formData, context) => {
    const isRecurring = formData.priceType === PriceTypeEnum.RECURRING;
    const isMetered = isRecurring && formData.usageType === UsageTypeEnum.METERED;

    if (isRecurring && formData.intervalCount === null) {
      context.addIssue({
        code: 'custom',
        path: ['intervalCount'],
        message: 'Số chu kỳ là bắt buộc với giá định kỳ',
      });
    }

    if (isMetered && !formData.meterId) {
      context.addIssue({
        code: 'custom',
        path: ['meterId'],
        message: 'Giá metered phải gắn một meter',
      });
    }

    if (formData.billingScheme === BillingSchemeEnum.PER_UNIT && formData.unitAmount === null) {
      context.addIssue({
        code: 'custom',
        path: ['unitAmount'],
        message: 'Đơn giá là bắt buộc khi tính theo đơn vị',
      });

      return;
    }

    if (formData.billingScheme !== BillingSchemeEnum.TIERED) {
      return;
    }

    if (size(formData.tiers) === 0) {
      context.addIssue({
        code: 'custom',
        path: ['tiers'],
        message: 'Giá theo bậc cần ít nhất một bậc',
      });

      return;
    }

    const lastTier = last(formData.tiers);

    if (lastTier && lastTier.upTo !== null) {
      context.addIssue({
        code: 'custom',
        path: ['tiers'],
        message: 'Bậc cuối phải để trống ngưỡng để bắt hết phần còn lại',
      });
    }
  });

export type PriceFormData = z.infer<typeof priceFormSchema>;

export type PriceTierFormData = PriceFormData['tiers'][number];

export const priceFormResolver = zodResolver(priceFormSchema);

export const priceFormDefaultValues: PriceFormData = {
  productId: '',
  lookupKey: '',
  currency: CurrencyEnum.VND,
  nickname: '',
  effectiveAt: '',
  priceType: PriceTypeEnum.RECURRING,
  interval: RecurringIntervalEnum.MONTH,
  intervalCount: 1,
  usageType: UsageTypeEnum.LICENSED,
  meterId: '',
  billingScheme: BillingSchemeEnum.PER_UNIT,
  unitAmount: null,
  tiersMode: TiersModeEnum.GRADUATED,
  tiers: [],
};

function toOptionalNumber(value: number | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  return value;
}

function toTierPayload(tier: PriceTierFormData): PriceTierPayload {
  return {
    upTo: tier.upTo,
    unitAmount: toOptionalNumber(tier.unitAmount),
    flatAmount: toOptionalNumber(tier.flatAmount),
  };
}

export function priceFormDataToPayload(formData: PriceFormData): CreatePricePayload {
  const isRecurring = formData.priceType === PriceTypeEnum.RECURRING;
  const isTiered = formData.billingScheme === BillingSchemeEnum.TIERED;
  const isMetered = isRecurring && formData.usageType === UsageTypeEnum.METERED;

  const recurring = isRecurring
    ? {
        interval: formData.interval,
        intervalCount: toOptionalNumber(formData.intervalCount),
        usageType: formData.usageType,
      }
    : undefined;

  const effectiveAt = formData.effectiveAt
    ? new Date(formData.effectiveAt).toISOString()
    : undefined;

  const unitAmount = isTiered ? undefined : toOptionalNumber(formData.unitAmount);
  const tiersMode = isTiered ? formData.tiersMode : undefined;
  const tiers = isTiered ? map(formData.tiers, toTierPayload) : undefined;
  const meterId = isMetered ? formData.meterId : undefined;

  return {
    productId: formData.productId,
    currency: formData.currency,
    lookupKey: formData.lookupKey || undefined,
    nickname: formData.nickname || undefined,
    effectiveAt,
    billingScheme: formData.billingScheme,
    unitAmount,
    tiersMode,
    tiers,
    meterId,
    recurring,
  };
}
