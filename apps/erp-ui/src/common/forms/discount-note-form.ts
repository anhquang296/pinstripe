import { zodResolver } from '@hookform/resolvers/zod';
import type { DiscountResponse, UpdateDiscountPayload } from '@vxrerp/sdk';
import { get } from 'lodash-es';
import { z } from 'zod';

const DISCOUNT_NOTE_KEY = 'note';

const discountNoteFormSchema = z.object({
  note: z.string().min(1, 'Ghi chú là bắt buộc'),
});

export type DiscountNoteFormData = z.infer<typeof discountNoteFormSchema>;

export const discountNoteFormResolver = zodResolver(discountNoteFormSchema);

export const discountNoteFormDefaultValues: DiscountNoteFormData = {
  note: '',
};

export function discountToNoteFormData(discount: DiscountResponse): DiscountNoteFormData {
  return {
    note: get(discount.metadata, DISCOUNT_NOTE_KEY, ''),
  };
}

export function discountNoteFormDataToPayload(
  formData: DiscountNoteFormData,
): UpdateDiscountPayload {
  return {
    metadata: { [DISCOUNT_NOTE_KEY]: formData.note },
  };
}
