import { zodResolver } from '@hookform/resolvers/zod';
import type {
  CreateInvoiceItemPayload,
  InvoiceItemResponse,
  UpdateInvoiceItemPayload,
} from '@pinstripe/sdk';
import { z } from 'zod';

const invoiceItemFormSchema = z.object({
  description: z.string().min(1, 'Diễn giải là bắt buộc'),
  quantity: z.number({ message: 'Số lượng phải là số' }).min(0, 'Số lượng không âm'),
  unitAmount: z
    .number({ message: 'Đơn giá phải là số' })
    .int('Đơn giá phải là số nguyên')
    .min(0, 'Đơn giá không âm'),
  discountable: z.boolean(),
});

export type InvoiceItemFormData = z.infer<typeof invoiceItemFormSchema>;

export const invoiceItemFormResolver = zodResolver(invoiceItemFormSchema);

export const invoiceItemFormDefaultValues: InvoiceItemFormData = {
  description: '',
  quantity: 1,
  unitAmount: 0,
  discountable: true,
};

export function invoiceItemToFormData(invoiceItem: InvoiceItemResponse): InvoiceItemFormData {
  const { unitAmount } = invoiceItem;

  return {
    description: invoiceItem.description,
    quantity: invoiceItem.quantity,
    unitAmount: unitAmount === null ? invoiceItem.amount : unitAmount,
    discountable: invoiceItem.discountable,
  };
}

export function invoiceItemFormDataToPayload(
  customerId: string,
  invoiceId: string,
  formData: InvoiceItemFormData,
): CreateInvoiceItemPayload {
  return {
    customerId,
    invoiceId,
    description: formData.description,
    quantity: formData.quantity,
    unitAmount: formData.unitAmount,
    discountable: formData.discountable,
  };
}

export function invoiceItemFormDataToUpdatePayload(
  formData: InvoiceItemFormData,
): UpdateInvoiceItemPayload {
  return {
    description: formData.description,
    quantity: formData.quantity,
    unitAmount: formData.unitAmount,
    discountable: formData.discountable,
  };
}
