import { zodResolver } from '@hookform/resolvers/zod';
import type { CreatePromotionCodePayload } from '@vxrerp/sdk';
import { z } from 'zod';

const promotionCodeFormSchema = z.object({
  couponId: z.string().min(1, 'Chọn coupon'),
  code: z.string(),
  maxRedemptions: z
    .number({ message: 'Số lần dùng phải là số' })
    .int('Số lần dùng phải là số nguyên')
    .min(0, 'Số lần dùng không âm'),
  minimumAmount: z
    .number({ message: 'Số tiền tối thiểu phải là số' })
    .int('Số tiền tối thiểu phải là số nguyên')
    .min(0, 'Số tiền tối thiểu không âm'),
  firstTimeTransaction: z.enum(['no', 'yes'], { message: 'Chọn một giá trị' }),
});

export type PromotionCodeFormData = z.infer<typeof promotionCodeFormSchema>;

export const promotionCodeFormResolver = zodResolver(promotionCodeFormSchema);

export const promotionCodeFormDefaultValues: PromotionCodeFormData = {
  couponId: '',
  code: '',
  maxRedemptions: 0,
  minimumAmount: 0,
  firstTimeTransaction: 'no',
};

export function promotionCodeFormDataToPayload(
  formData: PromotionCodeFormData,
): CreatePromotionCodePayload {
  const maxRedemptions = formData.maxRedemptions > 0 ? formData.maxRedemptions : undefined;
  const minimumAmount = formData.minimumAmount > 0 ? formData.minimumAmount : undefined;
  const firstTimeTransaction = formData.firstTimeTransaction === 'yes' ? true : undefined;

  return {
    couponId: formData.couponId,
    code: formData.code || undefined,
    maxRedemptions,
    minimumAmount,
    firstTimeTransaction,
  };
}
