import { RecurringIntervalEnum } from '@contracts/prices.types';
import { advancePeriod } from '@utils/billing-period';
import { describe, expect, it } from 'vitest';

describe('advancePeriod', () => {
  it('adds whole days for a daily interval', () => {
    const start = new Date('2026-01-01T08:30:00.000Z');

    const next = advancePeriod(start, RecurringIntervalEnum.DAY, 3);

    expect(next.toISOString()).toBe('2026-01-04T08:30:00.000Z');
  });

  it('adds seven days per week', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');

    const next = advancePeriod(start, RecurringIntervalEnum.WEEK, 2);

    expect(next.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('keeps the day of month for an ordinary month', () => {
    const start = new Date('2026-03-15T00:00:00.000Z');

    const next = advancePeriod(start, RecurringIntervalEnum.MONTH, 1);

    expect(next.toISOString()).toBe('2026-04-15T00:00:00.000Z');
  });

  it('clamps to the last day when the target month is shorter', () => {
    const start = new Date('2026-01-31T00:00:00.000Z');

    const next = advancePeriod(start, RecurringIntervalEnum.MONTH, 1);

    expect(next.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('clamps a 29 February anniversary in a non leap year', () => {
    const start = new Date('2028-02-29T00:00:00.000Z');

    const next = advancePeriod(start, RecurringIntervalEnum.YEAR, 1);

    expect(next.toISOString()).toBe('2029-02-28T00:00:00.000Z');
  });

  it('crosses the year boundary for a multi month interval', () => {
    const start = new Date('2026-11-30T00:00:00.000Z');

    const next = advancePeriod(start, RecurringIntervalEnum.MONTH, 3);

    expect(next.toISOString()).toBe('2027-02-28T00:00:00.000Z');
  });
});
