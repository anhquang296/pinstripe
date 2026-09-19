import { zodResolver } from '@hookform/resolvers/zod';
import type {
  CreateSubscriptionItemPayload,
  SubscriptionItemResponse,
  UpdateSubscriptionItemPayload,
} from '@pinstripe/sdk';
import { z } from 'zod';

const subscriptionItemFormSchema = z.object({
  priceId: z.string().min(1, 'Chọn bảng giá'),
  quantity: z
    .number({ message: 'Số lượng phải là số' })
    .int('Số lượng phải là số nguyên')
    .min(1, 'Số lượng tối thiểu là 1'),
});

export type SubscriptionItemFormData = z.infer<typeof subscriptionItemFormSchema>;

export const subscriptionItemFormResolver = zodResolver(subscriptionItemFormSchema);

export const subscriptionItemFormDefaultValues: SubscriptionItemFormData = {
  priceId: '',
  quantity: 1,
};

export function subscriptionItemToFormData(
  subscriptionItem: SubscriptionItemResponse,
): SubscriptionItemFormData {
  return {
    priceId: subscriptionItem.priceId,
    quantity: subscriptionItem.quantity,
  };
}

export function subscriptionItemFormDataToPayload(
  subscriptionId: string,
  formData: SubscriptionItemFormData,
): CreateSubscriptionItemPayload {
  return {
    subscriptionId,
    priceId: formData.priceId,
    quantity: formData.quantity,
  };
}

export function subscriptionItemFormDataToUpdatePayload(
  formData: SubscriptionItemFormData,
): UpdateSubscriptionItemPayload {
  return {
    priceId: formData.priceId,
    quantity: formData.quantity,
  };
}
