import { zodResolver } from '@hookform/resolvers/zod';
import { CollectionMethodEnum, CurrencyEnum } from '@vxrerp/billing/contracts';
import type { CreateInvoicePayload } from '@vxrerp/sdk';
import { z } from 'zod';

const invoiceFormSchema = z
  .object({
    customerId: z.string(),
    subscriptionId: z.string(),
    currency: z.nativeEnum(CurrencyEnum, { message: 'Chọn tiền tệ' }),
    collectionMethod: z.nativeEnum(CollectionMethodEnum, { message: 'Chọn cách thu tiền' }),
    daysUntilDue: z
      .number({ message: 'Số ngày phải là số' })
      .int('Số ngày phải là số nguyên')
      .min(0, 'Số ngày không âm')
      .max(365, 'Số ngày tối đa là 365'),
    autoAdvance: z.boolean(),
  })
  .refine(
    (formData) => {
      return Boolean(formData.customerId || formData.subscriptionId);
    },
    { message: 'Chọn customer hoặc subscription', path: ['customerId'] },
  );

export type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

export const invoiceFormResolver = zodResolver(invoiceFormSchema);

export const invoiceFormDefaultValues: InvoiceFormData = {
  customerId: '',
  subscriptionId: '',
  currency: CurrencyEnum.VND,
  collectionMethod: CollectionMethodEnum.CHARGE_AUTOMATICALLY,
  daysUntilDue: 7,
  autoAdvance: true,
};

export function invoiceFormDataToPayload(formData: InvoiceFormData): CreateInvoicePayload {
  return {
    customerId: formData.customerId || undefined,
    subscriptionId: formData.subscriptionId || undefined,
    currency: formData.currency,
    collectionMethod: formData.collectionMethod,
    daysUntilDue: formData.daysUntilDue,
    autoAdvance: formData.autoAdvance,
  };
}
