import type { RecurringInterval } from '@contracts/prices.types';
import { RecurringIntervalEnum } from '@contracts/prices.types';
import { BadRequestError } from '@vxrerp/platform/errors';

const DAYS_PER_MONTH = 30;
const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;

const MONTHLY_FACTORS: Record<RecurringInterval, number> = {
  [RecurringIntervalEnum.DAY]: DAYS_PER_MONTH,
  [RecurringIntervalEnum.WEEK]: DAYS_PER_MONTH / DAYS_PER_WEEK,
  [RecurringIntervalEnum.MONTH]: 1,
  [RecurringIntervalEnum.YEAR]: 1 / MONTHS_PER_YEAR,
};

export function buildMonthlyAmount(
  amount: number,
  interval: RecurringInterval,
  intervalCount: number,
): number {
  if (intervalCount <= 0) {
    throw new BadRequestError('A recurring interval must repeat at least once');
  }

  return Math.round((amount * MONTHLY_FACTORS[interval]) / intervalCount);
}
