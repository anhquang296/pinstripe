import type { RecurringInterval } from '@contracts/prices.types';
import { RecurringIntervalEnum } from '@contracts/prices.types';
import { MILLISECONDS_PER_DAY } from '@vxrerp/platform/constants';

const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;

function addDays(start: Date, days: number): Date {
  return new Date(start.getTime() + days * MILLISECONDS_PER_DAY);
}

function addMonths(start: Date, months: number): Date {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const day = start.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0, 0, 0, 0, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(day, lastDayOfTargetMonth),
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds(),
    ),
  );
}

export function advancePeriod(start: Date, interval: RecurringInterval, count: number): Date {
  if (interval === RecurringIntervalEnum.DAY) {
    return addDays(start, count);
  }

  if (interval === RecurringIntervalEnum.WEEK) {
    return addDays(start, count * DAYS_PER_WEEK);
  }

  if (interval === RecurringIntervalEnum.MONTH) {
    return addMonths(start, count);
  }

  return addMonths(start, count * MONTHS_PER_YEAR);
}

export function regressPeriod(end: Date, interval: RecurringInterval, count: number): Date {
  return advancePeriod(end, interval, -count);
}

export function countPeriodsElapsed(
  periodStart: Date,
  interval: RecurringInterval,
  count: number,
  until: Date,
): number {
  let elapsed = 0;
  let cursor = periodStart;

  while (cursor.getTime() <= until.getTime()) {
    cursor = advancePeriod(cursor, interval, count);
    elapsed += 1;
  }

  return elapsed;
}
