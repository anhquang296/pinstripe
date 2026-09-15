import type { ReverseLedgerTransactionPayload } from '@api/ledger';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const reverseTransactionFormSchema = z.object({
  reason: z.string().min(1, 'Lý do đảo bút toán là bắt buộc'),
});

export type ReverseTransactionFormData = z.infer<typeof reverseTransactionFormSchema>;

export const reverseTransactionFormResolver = zodResolver(reverseTransactionFormSchema);

export const reverseTransactionFormDefaultValues: ReverseTransactionFormData = {
  reason: '',
};

export function reverseTransactionFormDataToPayload(
  formData: ReverseTransactionFormData,
): ReverseLedgerTransactionPayload {
  return { reason: formData.reason };
}
