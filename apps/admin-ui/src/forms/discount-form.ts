import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateDiscountPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const discountFormSchema = z
  .object({
    couponId: z.string(),
    promotionCode: z.string(),
    customerId: z.string(),
    subscriptionId: z.string(),
  })
  .refine(
    (formData) => {
      return Boolean(formData.couponId) !== Boolean(formData.promotionCode);
    },
    { message: 'Chọn coupon hoặc nhập mã khuyến mãi, không dùng cả hai', path: ['couponId'] },
  )
  .refine(
    (formData) => {
      return Boolean(formData.customerId) || Boolean(formData.subscriptionId);
    },
    { message: 'Chọn khách hàng hoặc subscription để áp giảm giá', path: ['subscriptionId'] },
  );

export type DiscountFormData = z.infer<typeof discountFormSchema>;

export const discountFormResolver = zodResolver(discountFormSchema);

export const discountFormDefaultValues: DiscountFormData = {
  couponId: '',
  promotionCode: '',
  customerId: '',
  subscriptionId: '',
};

export function discountFormDataToPayload(formData: DiscountFormData): CreateDiscountPayload {
  return {
    couponId: formData.couponId || undefined,
    promotionCode: formData.promotionCode || undefined,
    customerId: formData.customerId || undefined,
    subscriptionId: formData.subscriptionId || undefined,
  };
}
