import { zodResolver } from '@hookform/resolvers/zod';
import { CurrencyEnum, LedgerAccountCodeEnum, PostingDirectionEnum } from '@vxrerp/core/contracts';
import type { PostLedgerTransactionPayload } from '@vxrerp/sdk';
import { filter, map, sumBy } from 'lodash-es';
import { z } from 'zod';

const ledgerTransactionEntrySchema = z.object({
  accountCode: z.nativeEnum(LedgerAccountCodeEnum, { message: 'Chọn tài khoản' }),
  customerId: z.string(),
  direction: z.nativeEnum(PostingDirectionEnum, { message: 'Chọn chiều bút toán' }),
  amount: z
    .number({ message: 'Số tiền phải là số' })
    .int('Số tiền phải là số nguyên')
    .min(1, 'Số tiền phải lớn hơn 0'),
});

export type LedgerTransactionEntryFormData = z.infer<typeof ledgerTransactionEntrySchema>;

function sumDirection(
  entries: LedgerTransactionEntryFormData[],
  direction: PostingDirectionEnum,
): number {
  const directedEntries = filter(entries, (entry) => {
    return entry.direction === direction;
  });

  return sumBy(directedEntries, 'amount');
}

const ledgerTransactionFormSchema = z
  .object({
    description: z.string().min(1, 'Diễn giải là bắt buộc'),
    currency: z.nativeEnum(CurrencyEnum, { message: 'Chọn tiền tệ' }),
    externalId: z.string(),
    entries: z.array(ledgerTransactionEntrySchema).min(2, 'Bút toán cần ít nhất hai dòng'),
  })
  .refine(
    (formData) => {
      return (
        sumDirection(formData.entries, PostingDirectionEnum.DEBIT) ===
        sumDirection(formData.entries, PostingDirectionEnum.CREDIT)
      );
    },
    { message: 'Tổng nợ phải bằng tổng có', path: ['entries'] },
  );

export type LedgerTransactionFormData = z.infer<typeof ledgerTransactionFormSchema>;

export const ledgerTransactionFormResolver = zodResolver(ledgerTransactionFormSchema);

export const ledgerTransactionFormDefaultValues: LedgerTransactionFormData = {
  description: '',
  currency: CurrencyEnum.VND,
  externalId: '',
  entries: [
    {
      accountCode: LedgerAccountCodeEnum.CASH,
      customerId: '',
      direction: PostingDirectionEnum.DEBIT,
      amount: 0,
    },
    {
      accountCode: LedgerAccountCodeEnum.REVENUE,
      customerId: '',
      direction: PostingDirectionEnum.CREDIT,
      amount: 0,
    },
  ],
};

export function ledgerTransactionFormDataToPayload(
  formData: LedgerTransactionFormData,
): PostLedgerTransactionPayload {
  return {
    description: formData.description,
    currency: formData.currency,
    externalId: formData.externalId || undefined,
    entries: map(formData.entries, (entry) => {
      return {
        accountCode: entry.accountCode,
        customerId: entry.customerId || undefined,
        direction: entry.direction,
        amount: entry.amount,
      };
    }),
  };
}
