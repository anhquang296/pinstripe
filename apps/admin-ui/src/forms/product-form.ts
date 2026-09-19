import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateProductPayload, ProductResponse, UpdateProductPayload } from '@pinstripe/sdk';
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

export function productToFormData(product: ProductResponse): ProductFormData {
  return {
    name: product.name,
    description: product.description,
    unitLabel: product.unitLabel,
  };
}

export function productFormDataToUpdatePayload(formData: ProductFormData): UpdateProductPayload {
  return {
    name: formData.name,
    description: formData.description,
    unitLabel: formData.unitLabel,
  };
}
