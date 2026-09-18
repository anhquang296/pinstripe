import { zodResolver } from '@hookform/resolvers/zod';
import { CurrencyEnum, PartnerPlatformEnum } from '@pinstripe/core/contracts';
import type { CreateCustomerPayload } from '@pinstripe/sdk';
import { z } from 'zod';

const customerFormSchema = z
  .object({
    email: z.string().min(1, 'Email là bắt buộc').email('Email không hợp lệ'),
    name: z.string().min(1, 'Tên khách hàng là bắt buộc'),
    currency: z.nativeEnum(CurrencyEnum, { message: 'Chọn một loại tiền tệ' }),
    partnerPlatform: z.union([z.nativeEnum(PartnerPlatformEnum), z.literal('')], {
      message: 'Chọn nền tảng đối tác',
    }),
    partnerAccountId: z.string().trim(),
  })
  .refine(
    (formData) => {
      return (formData.partnerPlatform === '') === (formData.partnerAccountId === '');
    },
    {
      message: 'Nền tảng đối tác và mã tài khoản đối tác phải nhập cùng nhau',
      path: ['partnerAccountId'],
    },
  );

export type CustomerFormData = z.infer<typeof customerFormSchema>;

export const customerFormResolver = zodResolver(customerFormSchema);

export const customerFormDefaultValues: CustomerFormData = {
  email: '',
  name: '',
  currency: CurrencyEnum.VND,
  partnerPlatform: '',
  partnerAccountId: '',
};

export function customerFormDataToPayload(formData: CustomerFormData): CreateCustomerPayload {
  const { partnerPlatform } = formData;

  if (partnerPlatform) {
    return {
      email: formData.email,
      name: formData.name,
      currency: formData.currency,
      partnerPlatform,
      partnerAccountId: formData.partnerAccountId,
    };
  }

  return {
    email: formData.email,
    name: formData.name,
    currency: formData.currency,
  };
}
