import { describe, expect, it } from 'vitest';

import { formatCurrency, formatDate } from './format';

describe('formatCurrency', () => {
  it('formats a zero-decimal currency straight from its minor unit', () => {
    const label = formatCurrency(799000, 'vnd');

    expect(label).toContain('799.000');
  });

  it('divides a two-decimal currency by one hundred', () => {
    const label = formatCurrency(1999, 'usd');

    expect(label).toContain('19,99');
  });

  it('formats zero without dropping the currency symbol', () => {
    const label = formatCurrency(0, 'VND');

    expect(label).toContain('0');
    expect(label).toContain('₫');
  });
});

describe('formatDate', () => {
  it('renders an ISO instant as dd/MM/yyyy in Vietnam time', () => {
    expect(formatDate('2026-09-19T05:00:00.000Z')).toBe('19/09/2026');
  });

  it('rolls an instant before Vietnam midnight into the local day', () => {
    expect(formatDate('2026-09-18T17:30:00.000Z')).toBe('19/09/2026');
  });

  it('returns an empty string for a value that is not a date', () => {
    expect(formatDate('not-a-date')).toBe('');
  });
});
