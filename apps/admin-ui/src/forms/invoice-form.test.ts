import { describe, expect, it } from 'vitest';

import type { InvoiceFormData } from './invoice-form';
import {
  invoiceFormDataToPayload,
  invoiceFormDefaultValues,
  invoiceFormResolver,
} from './invoice-form';

function makeFormData(overrides: Partial<InvoiceFormData> = {}): InvoiceFormData {
  return { ...invoiceFormDefaultValues, customerId: 'cus_1', ...overrides };
}

describe('invoiceFormResolver', () => {
  it('nhận hoá đơn chỉ khai customer', async () => {
    const formData = makeFormData();

    const result = await invoiceFormResolver(formData, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });

    expect(result.errors).toEqual({});
  });

  it('nhận hoá đơn chỉ khai subscription', async () => {
    const formData = makeFormData({ customerId: '', subscriptionId: 'sub_1' });

    const result = await invoiceFormResolver(formData, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });

    expect(result.errors).toEqual({});
  });

  it('từ chối hoá đơn không có customer lẫn subscription', async () => {
    const formData = makeFormData({ customerId: '', subscriptionId: '' });

    const result = await invoiceFormResolver(formData, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });

    expect(result.errors).toHaveProperty('customerId');
  });
});

describe('invoiceFormDataToPayload', () => {
  it('bỏ subscription rỗng khỏi payload', () => {
    const formData = makeFormData();

    const result = invoiceFormDataToPayload(formData);

    expect(result.customerId).toBe('cus_1');
    expect(result.subscriptionId).toBeUndefined();
  });
});
