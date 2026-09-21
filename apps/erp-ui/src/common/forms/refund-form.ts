import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateRefundPayload } from '@vxrerp/sdk';
import { z } from 'zod';

const refundFormSchema = z.object({
  chargeId: z.string().min(1, 'Chọn charge cần hoàn'),
  amount: z
    .number({ message: 'Số tiền phải là số' })
    .int('Số tiền phải là số nguyên')
    .min(1, 'Số tiền phải lớn hơn 0'),
  reason: z.string().min(1, 'Lý do hoàn tiền là bắt buộc'),
});

export type RefundFormData = z.infer<typeof refundFormSchema>;

export const refundFormResolver = zodResolver(refundFormSchema);

export const refundFormDefaultValues: RefundFormData = {
  chargeId: '',
  amount: 0,
  reason: '',
};

export function refundFormDataToPayload(formData: RefundFormData): CreateRefundPayload {
  return {
    chargeId: formData.chargeId,
    amount: formData.amount,
    reason: formData.reason,
  };
}
