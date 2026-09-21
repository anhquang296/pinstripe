import { zodResolver } from '@hookform/resolvers/zod';
import type { PriceResponse, UpdatePricePayload } from '@vxrerp/sdk';
import { z } from 'zod';

const priceUpdateFormSchema = z.object({
  nickname: z.string(),
  active: z.boolean(),
});

export type PriceUpdateFormData = z.infer<typeof priceUpdateFormSchema>;

export const priceUpdateFormResolver = zodResolver(priceUpdateFormSchema);

export const priceUpdateFormDefaultValues: PriceUpdateFormData = {
  nickname: '',
  active: true,
};

export function priceToUpdateFormData(price: PriceResponse): PriceUpdateFormData {
  return {
    nickname: price.nickname,
    active: price.active,
  };
}

export function priceUpdateFormDataToPayload(formData: PriceUpdateFormData): UpdatePricePayload {
  return {
    nickname: formData.nickname,
    active: formData.active,
  };
}
