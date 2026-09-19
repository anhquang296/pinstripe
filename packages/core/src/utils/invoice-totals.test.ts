import { buildInvoiceTotals } from '@utils/invoice-totals';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-19T08:00:00.000Z');
const DUE_SOON_BEFORE_AT = new Date('2026-09-26T08:00:00.000Z');

function makeBalance(
  overrides: { amountRemaining?: number; dueAt?: string | null; currency?: 'vnd' | 'usd' } = {},
) {
  return {
    currency: 'vnd' as const,
    amountRemaining: 100_000,
    dueAt: '2026-10-19T08:00:00.000Z',
    ...overrides,
  };
}

describe('buildInvoiceTotals', () => {
  it('returns no totals when the customer owes nothing', () => {
    expect(buildInvoiceTotals([], NOW, DUE_SOON_BEFORE_AT)).toEqual([]);
  });

  it('counts an invoice due one millisecond ago as overdue', () => {
    const balance = makeBalance({ dueAt: '2026-09-19T07:59:59.999Z' });

    const [totals] = buildInvoiceTotals([balance], NOW, DUE_SOON_BEFORE_AT);

    expect(totals).toMatchObject({ overdueAmount: 100_000, overdueCount: 1, dueSoonCount: 0 });
  });

  it('counts an invoice due exactly now as due soon rather than overdue', () => {
    const balance = makeBalance({ dueAt: NOW.toISOString() });

    const [totals] = buildInvoiceTotals([balance], NOW, DUE_SOON_BEFORE_AT);

    expect(totals).toMatchObject({
      overdueCount: 0,
      dueSoonCount: 1,
      nextDueAt: NOW.toISOString(),
    });
  });

  it('leaves an invoice due on the edge of the window out of due soon', () => {
    const balance = makeBalance({ dueAt: DUE_SOON_BEFORE_AT.toISOString() });

    const [totals] = buildInvoiceTotals([balance], NOW, DUE_SOON_BEFORE_AT);

    expect(totals).toMatchObject({ dueSoonCount: 0, openCount: 1 });
  });

  it('counts an invoice without a due date as open only', () => {
    const balance = makeBalance({ dueAt: null });

    const [totals] = buildInvoiceTotals([balance], NOW, DUE_SOON_BEFORE_AT);

    expect(totals).toMatchObject({
      openAmount: 100_000,
      overdueCount: 0,
      dueSoonCount: 0,
      nextDueAt: null,
    });
  });

  it('picks the earliest upcoming due date and ignores the overdue ones', () => {
    const balances = [
      makeBalance({ dueAt: '2026-09-01T00:00:00.000Z' }),
      makeBalance({ dueAt: '2026-10-05T00:00:00.000Z' }),
      makeBalance({ dueAt: '2026-09-22T00:00:00.000Z' }),
    ];

    const [totals] = buildInvoiceTotals(balances, NOW, DUE_SOON_BEFORE_AT);

    expect(totals).toMatchObject({
      openAmount: 300_000,
      openCount: 3,
      nextDueAt: '2026-09-22T00:00:00.000Z',
    });
  });

  it('keeps one set of totals per currency instead of adding them together', () => {
    const balances = [
      makeBalance({ currency: 'vnd', amountRemaining: 500_000 }),
      makeBalance({ currency: 'usd', amountRemaining: 2_500 }),
    ];

    const totals = buildInvoiceTotals(balances, NOW, DUE_SOON_BEFORE_AT);

    expect(totals).toEqual([
      expect.objectContaining({ currency: 'usd', openAmount: 2_500 }),
      expect.objectContaining({ currency: 'vnd', openAmount: 500_000 }),
    ]);
  });
});
