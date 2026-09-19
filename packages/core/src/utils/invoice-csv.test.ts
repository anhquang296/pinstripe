import type { InvoiceResponse } from '@contracts/invoices.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { CurrencyEnum } from '@utils/currency';
import { buildInvoicesCsv } from '@utils/invoice-csv';
import _ from 'lodash';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-19T08:00:00.000Z');

function makeInvoice(overrides: Partial<InvoiceResponse> = {}): InvoiceResponse {
  return {
    id: 'in_01',
    number: 'INV-000001',
    status: InvoiceStatusEnum.OPEN,
    currency: CurrencyEnum.VND,
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-09-01T00:00:00.000Z',
    finalizedAt: '2026-09-01T02:00:00.000Z',
    dueAt: '2026-09-25T00:00:00.000Z',
    total: 1_500_000,
    amountPaid: 0,
    amountRemaining: 1_500_000,
    ...overrides,
  } as InvoiceResponse;
}

function readLines(csv: string): string[] {
  return _.compact(csv.replace('﻿', '').split('\r\n'));
}

describe('buildInvoicesCsv', () => {
  it('starts with a byte order mark so Excel reads the Vietnamese headers', () => {
    const csv = buildInvoicesCsv([], NOW);

    expect(_.startsWith(csv, '﻿')).toBe(true);
    expect(_.first(readLines(csv))).toContain('Số hóa đơn');
  });

  it('writes one row per invoice with amounts in whole currency units', () => {
    const csv = buildInvoicesCsv([makeInvoice()], NOW);

    expect(readLines(csv)[1]).toBe(
      'INV-000001,01/08/2026,01/09/2026,01/09/2026,25/09/2026,Chưa thanh toán,1500000,0,1500000,VND',
    );
  });

  it('labels an open invoice past its due date as overdue', () => {
    const csv = buildInvoicesCsv([makeInvoice({ dueAt: '2026-09-10T00:00:00.000Z' })], NOW);

    expect(readLines(csv)[1]).toContain(',Quá hạn,');
  });

  it('quotes a cell that contains a comma or a quote', () => {
    const csv = buildInvoicesCsv([makeInvoice({ number: 'INV, "A"' })], NOW);

    expect(readLines(csv)[1]).toMatch(/^"INV, ""A"""/);
  });
});
