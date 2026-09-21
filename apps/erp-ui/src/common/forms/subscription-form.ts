import { zodResolver } from '@hookform/resolvers/zod';
import { CollectionMethodEnum } from '@vxrerp/billing/contracts';
import type { CreateSubscriptionPayload } from '@vxrerp/sdk';
import { z } from 'zod';

const MAX_TRIAL_DAYS = 730;

const subscriptionFormSchema = z.object({
  customerId: z.string().min(1, 'Chọn khách hàng'),
  priceId: z.string().min(1, 'Chọn bảng giá'),
  collectionMethod: z.nativeEnum(CollectionMethodEnum, { message: 'Chọn cách thu tiền' }),
  trialPeriodDays: z
    .number({ message: 'Số ngày trial phải là số' })
    .int('Số ngày trial phải là số nguyên')
    .min(0, 'Số ngày trial không được âm')
    .max(MAX_TRIAL_DAYS, `Trial tối đa ${MAX_TRIAL_DAYS} ngày`),
});

export type SubscriptionFormData = z.infer<typeof subscriptionFormSchema>;

export const subscriptionFormResolver = zodResolver(subscriptionFormSchema);

export const subscriptionFormDefaultValues: SubscriptionFormData = {
  customerId: '',
  priceId: '',
  collectionMethod: CollectionMethodEnum.CHARGE_AUTOMATICALLY,
  trialPeriodDays: 0,
};

export function subscriptionFormDataToPayload(
  formData: SubscriptionFormData,
): CreateSubscriptionPayload {
  const trialPeriodDays = formData.trialPeriodDays > 0 ? formData.trialPeriodDays : undefined;

  return {
    customerId: formData.customerId,
    items: [{ priceId: formData.priceId }],
    collectionMethod: formData.collectionMethod,
    trialPeriodDays,
  };
}
