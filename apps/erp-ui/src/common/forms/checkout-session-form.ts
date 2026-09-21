import { zodResolver } from '@hookform/resolvers/zod';
import { CheckoutSessionModeEnum } from '@vxrerp/core/contracts';
import type { CreateCheckoutSessionPayload } from '@vxrerp/sdk';
import { z } from 'zod';

const checkoutSessionFormSchema = z.object({
  mode: z.nativeEnum(CheckoutSessionModeEnum, { message: 'Chọn chế độ' }),
  customerId: z.string().min(1, 'Chọn khách hàng'),
  successUrl: z.string().min(1, 'URL thành công là bắt buộc'),
  cancelUrl: z.string(),
  priceId: z.string(),
  quantity: z
    .number({ message: 'Số lượng phải là số' })
    .int('Số lượng phải là số nguyên')
    .min(1, 'Số lượng tối thiểu là 1'),
});

export type CheckoutSessionFormData = z.infer<typeof checkoutSessionFormSchema>;

export const checkoutSessionFormResolver = zodResolver(checkoutSessionFormSchema);

export const checkoutSessionFormDefaultValues: CheckoutSessionFormData = {
  mode: CheckoutSessionModeEnum.PAYMENT,
  customerId: '',
  successUrl: '',
  cancelUrl: '',
  priceId: '',
  quantity: 1,
};

export function checkoutSessionFormDataToPayload(
  formData: CheckoutSessionFormData,
): CreateCheckoutSessionPayload {
  const lineItems = formData.priceId
    ? [{ priceId: formData.priceId, quantity: formData.quantity }]
    : undefined;

  return {
    mode: formData.mode,
    customerId: formData.customerId,
    successUrl: formData.successUrl,
    cancelUrl: formData.cancelUrl || undefined,
    lineItems,
  };
}
