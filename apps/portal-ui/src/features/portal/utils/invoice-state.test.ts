import {
  resolveInvoiceStatusLabel,
  resolveOverdueDays,
} from '@features/portal/utils/invoice-state';
import { InvoiceStatusEnum } from '@pinstripe/core/contracts';
import { expect, it } from 'vitest';

const NOW = new Date('2026-09-19T08:00:00.000Z');

it('counts no late days for an open invoice due in the future', () => {
  const invoice = { status: InvoiceStatusEnum.OPEN, dueAt: '2026-09-20T08:00:00.000Z' };

  expect(resolveOverdueDays(invoice, NOW)).toBe(0);
});

it('counts no late days for an open invoice due exactly now', () => {
  const invoice = { status: InvoiceStatusEnum.OPEN, dueAt: NOW.toISOString() };

  expect(resolveOverdueDays(invoice, NOW)).toBe(0);
});

it('counts one late day for an invoice due earlier the same day', () => {
  const invoice = { status: InvoiceStatusEnum.OPEN, dueAt: '2026-09-19T07:59:59.000Z' };

  expect(resolveOverdueDays(invoice, NOW)).toBe(1);
});

it('counts late days as calendar days in Vietnam time, not as 24-hour blocks', () => {
  const invoice = { status: InvoiceStatusEnum.OPEN, dueAt: '2026-09-15T07:00:00.000Z' };

  expect(resolveOverdueDays(invoice, NOW)).toBe(4);
});

it('moves to the next calendar day at midnight in Vietnam, not at midnight UTC', () => {
  const invoice = { status: InvoiceStatusEnum.OPEN, dueAt: '2026-09-18T16:30:00.000Z' };

  expect(resolveOverdueDays(invoice, new Date('2026-09-18T17:30:00.000Z'))).toBe(1);
  expect(resolveOverdueDays(invoice, new Date('2026-09-19T16:30:00.000Z'))).toBe(1);
  expect(resolveOverdueDays(invoice, new Date('2026-09-19T17:30:00.000Z'))).toBe(2);
});

it('never marks a paid invoice as late, whatever its due date', () => {
  const invoice = { status: InvoiceStatusEnum.PAID, dueAt: '2026-08-01T00:00:00.000Z' };

  expect(resolveOverdueDays(invoice, NOW)).toBe(0);
  expect(resolveInvoiceStatusLabel(invoice, NOW).label).toBe('Đã thanh toán');
});

it('labels a late open invoice as overdue', () => {
  const invoice = { status: InvoiceStatusEnum.OPEN, dueAt: '2026-09-10T00:00:00.000Z' };

  expect(resolveInvoiceStatusLabel(invoice, NOW)).toEqual({ label: 'Quá hạn', tone: 'danger' });
});
