import { describe, expect, it } from 'vitest';

import { serializeInvoiceSearch } from './invoices.search-params';

describe('serializeInvoiceSearch', () => {
  it('carries the customer filter onto another status path', () => {
    const result = serializeInvoiceSearch('/invoices/open', { customerId: 'cus_1', after: null });

    expect(result).toBe('/invoices/open?customerId=cus_1');
  });

  it('drops the cursor so a tab switch lands on the first page', () => {
    const result = serializeInvoiceSearch('/invoices/paid', { customerId: null, after: null });

    expect(result).toBe('/invoices/paid');
  });
});
