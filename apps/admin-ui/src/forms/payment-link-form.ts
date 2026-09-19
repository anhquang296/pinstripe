import { zodResolver } from '@hookform/resolvers/zod';
import { toEnumMember } from '@lib/enum';
import { CheckoutSessionModeEnum } from '@pinstripe/core/contracts';
import type {
  CreatePaymentLinkPayload,
  PaymentLinkResponse,
  UpdatePaymentLinkPayload,
} from '@pinstripe/sdk';
import { z } from 'zod';

const paymentLinkFormSchema = z.object({
  mode: z.nativeEnum(CheckoutSessionModeEnum, { message: 'Chọn chế độ' }),
  successUrl: z.string().min(1, 'URL thành công là bắt buộc'),
  priceId: z.string().min(1, 'Chọn bảng giá'),
  quantity: z
    .number({ message: 'Số lượng phải là số' })
    .int('Số lượng phải là số nguyên')
    .min(1, 'Số lượng tối thiểu là 1'),
  isActive: z.boolean(),
});

export type PaymentLinkFormData = z.infer<typeof paymentLinkFormSchema>;

export const paymentLinkFormResolver = zodResolver(paymentLinkFormSchema);

export const paymentLinkFormDefaultValues: PaymentLinkFormData = {
  mode: CheckoutSessionModeEnum.PAYMENT,
  successUrl: '',
  priceId: '',
  quantity: 1,
  isActive: true,
};

export function paymentLinkToFormData(paymentLink: PaymentLinkResponse): PaymentLinkFormData {
  const [lineItem] = paymentLink.lineItems;

  return {
    mode: toEnumMember(CheckoutSessionModeEnum, paymentLink.mode, CheckoutSessionModeEnum.PAYMENT),
    successUrl: paymentLink.successUrl,
    priceId: lineItem ? lineItem.priceId : '',
    quantity: lineItem ? lineItem.quantity : 1,
    isActive: paymentLink.isActive,
  };
}

export function paymentLinkFormDataToPayload(
  formData: PaymentLinkFormData,
): CreatePaymentLinkPayload {
  return {
    mode: formData.mode,
    successUrl: formData.successUrl,
    lineItems: [{ priceId: formData.priceId, quantity: formData.quantity }],
  };
}

export function paymentLinkFormDataToUpdatePayload(
  formData: PaymentLinkFormData,
): UpdatePaymentLinkPayload {
  return {
    successUrl: formData.successUrl,
    isActive: formData.isActive,
  };
}
