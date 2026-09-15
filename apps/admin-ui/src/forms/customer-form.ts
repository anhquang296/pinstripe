import type { CreateCustomerPayload } from '@api/customers';
import { zodResolver } from '@hookform/resolvers/zod';
import { CurrencyEnum } from '@pinstripe/core/contracts';
import { z } from 'zod';

const customerFormSchema = z.object({
  email: z.string().min(1, 'Email là bắt buộc').email('Email không hợp lệ'),
  name: z.string().min(1, 'Tên khách hàng là bắt buộc'),
  currency: z.nativeEnum(CurrencyEnum, { message: 'Chọn một loại tiền tệ' }),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;

export const customerFormResolver = zodResolver(customerFormSchema);

export const customerFormDefaultValues: CustomerFormData = {
  email: '',
  name: '',
  currency: CurrencyEnum.VND,
};

export function customerFormDataToPayload(formData: CustomerFormData): CreateCustomerPayload {
  return {
    email: formData.email,
    name: formData.name,
    currency: formData.currency,
  };
}
