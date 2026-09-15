import { CurrencyEnum } from '@pinstripe/core/contracts';
import { z } from 'zod';

export const createCustomerFormSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  name: z.string().min(1, 'Tên khách hàng là bắt buộc'),
  currency: z.nativeEnum(CurrencyEnum),
});

export type CreateCustomerFormValues = z.infer<typeof createCustomerFormSchema>;

export const createCustomerFormDefaultValues: CreateCustomerFormValues = {
  email: '',
  name: '',
  currency: CurrencyEnum.VND,
};
