import { zodResolver } from '@hookform/resolvers/zod';
import type { Currency } from '@vxrerp/core/contracts';
import type { CreateCustomerBalanceTransactionPayload } from '@vxrerp/sdk';
import { z } from 'zod';

const balanceTransactionFormSchema = z.object({
  amount: z
    .number({ message: 'Số tiền phải là số' })
    .int('Số tiền phải là số nguyên')
    .refine((amount) => {
      return amount !== 0;
    }, 'Số tiền phải khác 0'),
  description: z.string(),
});

export type BalanceTransactionFormData = z.infer<typeof balanceTransactionFormSchema>;

export const balanceTransactionFormResolver = zodResolver(balanceTransactionFormSchema);

export const balanceTransactionFormDefaultValues: BalanceTransactionFormData = {
  amount: 0,
  description: '',
};

export function balanceTransactionFormDataToPayload(
  currency: Currency,
  formData: BalanceTransactionFormData,
): CreateCustomerBalanceTransactionPayload {
  return {
    currency,
    amount: formData.amount,
    description: formData.description || undefined,
  };
}
