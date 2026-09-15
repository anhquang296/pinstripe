import { z } from 'zod';

export const createSubscriptionFormSchema = z.object({
  customerId: z.string().min(1, 'Chọn khách hàng'),
  priceId: z.string().min(1, 'Chọn bảng giá'),
  trialPeriodDays: z.number().int().min(0).max(730),
});

export type CreateSubscriptionFormValues = z.infer<typeof createSubscriptionFormSchema>;

export const createSubscriptionFormDefaultValues: CreateSubscriptionFormValues = {
  customerId: '',
  priceId: '',
  trialPeriodDays: 0,
};
