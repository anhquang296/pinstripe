import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateProductPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const productFormSchema = z.object({
  name: z.string().min(1, 'Tên product là bắt buộc'),
  description: z.string(),
  unitLabel: z.string(),
});

export type ProductFormData = z.infer<typeof productFormSchema>;

export const productFormResolver = zodResolver(productFormSchema);

export const productFormDefaultValues: ProductFormData = {
  name: '',
  description: '',
  unitLabel: '',
};

export function productFormDataToPayload(formData: ProductFormData): CreateProductPayload {
  return {
    name: formData.name,
    description: formData.description || undefined,
    unitLabel: formData.unitLabel || undefined,
  };
}
