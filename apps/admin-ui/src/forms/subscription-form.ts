import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateSubscriptionPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const MAX_TRIAL_DAYS = 730;

const subscriptionFormSchema = z.object({
  customerId: z.string().min(1, 'Chọn khách hàng'),
  priceId: z.string().min(1, 'Chọn bảng giá'),
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
  trialPeriodDays: 0,
};

export function subscriptionFormDataToPayload(
  formData: SubscriptionFormData,
): CreateSubscriptionPayload {
  const trialPeriodDays = formData.trialPeriodDays > 0 ? formData.trialPeriodDays : undefined;

  return {
    customerId: formData.customerId,
    items: [{ priceId: formData.priceId }],
    trialPeriodDays,
  };
}
