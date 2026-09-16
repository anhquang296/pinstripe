import { RecurringIntervalEnum } from '@contracts/prices.types';
import { buildMonthlyAmount } from '@utils/recurring-amount';
import { describe, expect, it } from 'vitest';

describe('buildMonthlyAmount', () => {
  it.each([
    { interval: RecurringIntervalEnum.MONTH, intervalCount: 1, expected: 120_000 },
    { interval: RecurringIntervalEnum.YEAR, intervalCount: 1, expected: 10_000 },
    { interval: RecurringIntervalEnum.WEEK, intervalCount: 1, expected: 514_286 },
    { interval: RecurringIntervalEnum.DAY, intervalCount: 1, expected: 3_600_000 },
  ])('normalises 120000 per $intervalCount $interval to $expected a month', (scenario) => {
    const monthly = buildMonthlyAmount(120_000, scenario.interval, scenario.intervalCount);

    expect(monthly).toBe(scenario.expected);
  });

  it('halves the monthly figure when the same amount covers two months', () => {
    const monthly = buildMonthlyAmount(120_000, RecurringIntervalEnum.MONTH, 2);

    expect(monthly).toBe(60_000);
  });

  it('spreads a three year price across thirty six months', () => {
    const monthly = buildMonthlyAmount(360_000, RecurringIntervalEnum.YEAR, 3);

    expect(monthly).toBe(10_000);
  });

  it('returns a whole number of minor units so it can be summed without drift', () => {
    const monthly = buildMonthlyAmount(100_000, RecurringIntervalEnum.YEAR, 7);

    expect(Number.isInteger(monthly)).toBe(true);
  });

  it('rejects an interval that never repeats', () => {
    const act = () => {
      return buildMonthlyAmount(1_000, RecurringIntervalEnum.MONTH, 0);
    };

    expect(act).toThrowError(/at least once/);
  });
});
