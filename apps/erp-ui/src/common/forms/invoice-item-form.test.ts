import { CurrencyEnum } from '@vxrerp/billing/contracts';
import type { InvoiceItemResponse } from '@vxrerp/sdk';
import { describe, expect, it } from 'vitest';

import {
  invoiceItemFormDataToPayload,
  invoiceItemFormDataToUpdatePayload,
  invoiceItemToFormData,
} from './invoice-item-form';

function makeInvoiceItem(overrides: Partial<InvoiceItemResponse> = {}): InvoiceItemResponse {
  return {
    id: 'ii_1',
    customerId: 'cus_1',
    invoiceId: 'in_1',
    subscriptionId: null,
    priceId: null,
    currency: CurrencyEnum.VND,
    description: 'Phí dịch vụ',
    quantity: 2,
    unitAmount: 50_000,
    amount: 100_000,
    discountable: true,
    taxRates: [],
    periodStart: '2026-09-01T00:00:00.000Z',
    periodEnd: '2026-09-30T00:00:00.000Z',
    metadata: {},
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('invoiceItemToFormData', () => {
  it('giữ nguyên đơn giá khi invoice item có unitAmount', () => {
    const invoiceItem = makeInvoiceItem();

    const result = invoiceItemToFormData(invoiceItem);

    expect(result.unitAmount).toBe(50_000);
  });

  it('lấy amount làm đơn giá khi unitAmount là null', () => {
    const invoiceItem = makeInvoiceItem({ unitAmount: null });

    const result = invoiceItemToFormData(invoiceItem);

    expect(result.unitAmount).toBe(100_000);
  });
});

describe('invoiceItemFormDataToPayload', () => {
  it('gắn customer và invoice vào payload tạo mới', () => {
    const formData = invoiceItemToFormData(makeInvoiceItem());

    const result = invoiceItemFormDataToPayload('cus_2', 'in_2', formData);

    expect(result).toEqual({
      customerId: 'cus_2',
      invoiceId: 'in_2',
      description: 'Phí dịch vụ',
      quantity: 2,
      unitAmount: 50_000,
      discountable: true,
    });
  });

  it('không mang customer hay invoice sang payload cập nhật', () => {
    const formData = invoiceItemToFormData(makeInvoiceItem());

    const result = invoiceItemFormDataToUpdatePayload(formData);

    expect(result).toEqual({
      description: 'Phí dịch vụ',
      quantity: 2,
      unitAmount: 50_000,
      discountable: true,
    });
  });
});
