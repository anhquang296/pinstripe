import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateCreditNotePayload } from '@pinstripe/sdk';
import { z } from 'zod';

const creditNoteFormSchema = z.object({
  amount: z
    .number({ message: 'Số tiền phải là số' })
    .int('Số tiền phải là số nguyên')
    .min(1, 'Số tiền phải lớn hơn 0'),
  description: z.string(),
  refundAmount: z
    .number({ message: 'Số tiền hoàn phải là số' })
    .int('Số tiền hoàn phải là số nguyên')
    .min(0, 'Số tiền hoàn không âm'),
  reason: z.string().min(1, 'Lý do là bắt buộc'),
});

export type CreditNoteFormData = z.infer<typeof creditNoteFormSchema>;

export const creditNoteFormResolver = zodResolver(creditNoteFormSchema);

export const creditNoteFormDefaultValues: CreditNoteFormData = {
  amount: 0,
  description: '',
  refundAmount: 0,
  reason: '',
};

export function creditNoteFormDataToPayload(
  invoiceId: string,
  formData: CreditNoteFormData,
): CreateCreditNotePayload {
  return {
    invoiceId,
    lines: [{ amount: formData.amount, description: formData.description || undefined }],
    refundAmount: formData.refundAmount,
    reason: formData.reason,
  };
}
