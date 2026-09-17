import { zodResolver } from '@hookform/resolvers/zod';
import { CouponDurationEnum, CurrencyEnum } from '@pinstripe/core/contracts';
import type { CreateCouponPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const couponFormSchema = z
  .object({
    name: z.string().min(1, 'Tên coupon là bắt buộc'),
    kind: z.enum(['percent', 'amount'], { message: 'Chọn kiểu giảm giá' }),
    percentOff: z.coerce.number().min(0, 'Phần trăm không âm').max(100, 'Tối đa 100%'),
    amountOff: z.coerce.number().min(0, 'Số tiền không âm'),
    duration: z.nativeEnum(CouponDurationEnum, { message: 'Chọn thời hạn' }),
    durationInMonths: z.coerce.number().min(0, 'Số tháng không âm'),
    maxRedemptions: z.coerce.number().min(0, 'Số lần dùng không âm'),
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

  return {
    name: formData.name,
    duration: formData.duration,
    percentOff: isPercent ? formData.percentOff : undefined,
    amountOff: isPercent ? undefined : formData.amountOff,
    currency: isPercent ? undefined : CurrencyEnum.VND,
    durationInMonths:
      formData.duration === CouponDurationEnum.REPEATING ? formData.durationInMonths : undefined,
    maxRedemptions: formData.maxRedemptions > 0 ? formData.maxRedemptions : undefined,
  };
}
