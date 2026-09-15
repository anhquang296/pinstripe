import { z } from 'zod';

export const createProductFormSchema = z.object({
  name: z.string().min(1, 'Tên product là bắt buộc'),
  description: z.string().optional(),
  unitLabel: z.string().optional(),
});

export type CreateProductFormValues = z.infer<typeof createProductFormSchema>;

export const createProductFormDefaultValues: CreateProductFormValues = {
  name: '',
  description: '',
  unitLabel: '',
};
