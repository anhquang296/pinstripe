import { zodResolver } from '@hookform/resolvers/zod';
import { CouponDurationEnum, CurrencyEnum } from '@pinstripe/core/contracts';
import type { CreateCouponPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const couponFormSchema = z
  .object({
    name: z.string().min(1, 'Tên coupon là bắt buộc'),
    kind: z.enum(['percent', 'amount'], { message: 'Chọn kiểu giảm giá' }),
    percentOff: z
      .number({ message: 'Phần trăm phải là số' })
      .min(0, 'Phần trăm không âm')
      .max(100, 'Tối đa 100%'),
    amountOff: z
      .number({ message: 'Số tiền phải là số' })
      .int('Số tiền phải là số nguyên')
      .min(0, 'Số tiền không âm'),
    duration: z.nativeEnum(CouponDurationEnum, { message: 'Chọn thời hạn' }),
    durationInMonths: z
      .number({ message: 'Số tháng phải là số' })
      .int('Số tháng phải là số nguyên')
      .min(0, 'Số tháng không âm'),
    maxRedemptions: z
      .number({ message: 'Số lần dùng phải là số' })
      .int('Số lần dùng phải là số nguyên')
      .min(0, 'Số lần dùng không âm'),
  })
  .refine(
    (formData) => {
      return formData.kind === 'amount' || formData.percentOff > 0;
    },
    { message: 'Phần trăm phải lớn hơn 0', path: ['percentOff'] },
  )
  .refine(
    (formData) => {
      return formData.kind === 'percent' || formData.amountOff > 0;
    },
    { message: 'Số tiền phải lớn hơn 0', path: ['amountOff'] },
  )
  .refine(
    (formData) => {
      return formData.duration !== CouponDurationEnum.REPEATING || formData.durationInMonths > 0;
    },
    { message: 'Coupon repeating cần số tháng', path: ['durationInMonths'] },
  );

export type CouponFormData = z.infer<typeof couponFormSchema>;

export const couponFormResolver = zodResolver(couponFormSchema);

export const couponFormDefaultValues: CouponFormData = {
  name: '',
  kind: 'percent',
  percentOff: 20,
  amountOff: 0,
  duration: CouponDurationEnum.REPEATING,
  durationInMonths: 3,
  maxRedemptions: 0,
};

export function couponFormDataToPayload(formData: CouponFormData): CreateCouponPayload {
  const isPercent = formData.kind === 'percent';
  const isRepeating = formData.duration === CouponDurationEnum.REPEATING;

  const percentOff = isPercent ? formData.percentOff : undefined;
  const amountOff = isPercent ? undefined : formData.amountOff;
  const currency = isPercent ? undefined : CurrencyEnum.VND;
  const durationInMonths = isRepeating ? formData.durationInMonths : undefined;
  const maxRedemptions = formData.maxRedemptions > 0 ? formData.maxRedemptions : undefined;

  return {
    name: formData.name,
    duration: formData.duration,
    percentOff,
    amountOff,
    currency,
    durationInMonths,
    maxRedemptions,
  };
}
