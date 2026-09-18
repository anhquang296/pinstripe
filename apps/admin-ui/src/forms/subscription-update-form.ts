import { zodResolver } from '@hookform/resolvers/zod';
import { toEnumMember } from '@lib/enum';
import { CollectionMethodEnum, ProrationBehaviorEnum } from '@pinstripe/core/contracts';
import type { SubscriptionResponse, UpdateSubscriptionPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const subscriptionUpdateFormSchema = z.object({
  collectionMethod: z.nativeEnum(CollectionMethodEnum, { message: 'Chọn cách thu tiền' }),
  prorationBehavior: z.nativeEnum(ProrationBehaviorEnum, { message: 'Chọn cách chia tiền lẻ kỳ' }),
  cancelAtPeriodEnd: z.boolean(),
});

export type SubscriptionUpdateFormData = z.infer<typeof subscriptionUpdateFormSchema>;

export const subscriptionUpdateFormResolver = zodResolver(subscriptionUpdateFormSchema);

export const subscriptionUpdateFormDefaultValues: SubscriptionUpdateFormData = {
  collectionMethod: CollectionMethodEnum.CHARGE_AUTOMATICALLY,
  prorationBehavior: ProrationBehaviorEnum.CREATE_PRORATIONS,
  cancelAtPeriodEnd: false,
};

export function subscriptionToUpdateFormData(
  subscription: SubscriptionResponse,
): SubscriptionUpdateFormData {
  return {
    collectionMethod: toEnumMember(
      CollectionMethodEnum,
      subscription.collectionMethod,
      CollectionMethodEnum.CHARGE_AUTOMATICALLY,
    ),
    prorationBehavior: ProrationBehaviorEnum.CREATE_PRORATIONS,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
}

export function subscriptionUpdateFormDataToPayload(
  formData: SubscriptionUpdateFormData,
): UpdateSubscriptionPayload {
  return {
    collectionMethod: formData.collectionMethod,
    prorationBehavior: formData.prorationBehavior,
    cancelAtPeriodEnd: formData.cancelAtPeriodEnd,
  };
}
