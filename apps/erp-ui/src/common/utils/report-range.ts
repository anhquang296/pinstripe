import { formatDate, VIETNAM_TIME_ZONE } from '@common/utils/format';
import type { CalendarDate } from '@internationalized/date';
import { parseDate, startOfMonth, today } from '@internationalized/date';
import { isNull } from 'lodash-es';

export enum ReportRangePresetEnum {
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  LAST_90_DAYS = 'last_90_days',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  CUSTOM = 'custom',
}

export type ReportRangePreset = `${ReportRangePresetEnum}`;

export const REPORT_RANGE_LABELS: Record<ReportRangePreset, string> = {
  [ReportRangePresetEnum.LAST_7_DAYS]: '7 ngày gần nhất',
  [ReportRangePresetEnum.LAST_30_DAYS]: '30 ngày gần nhất',
  [ReportRangePresetEnum.LAST_90_DAYS]: '90 ngày gần nhất',
  [ReportRangePresetEnum.THIS_MONTH]: 'Tháng này',
  [ReportRangePresetEnum.LAST_MONTH]: 'Tháng trước',
  [ReportRangePresetEnum.CUSTOM]: 'Tuỳ chọn',
};

const PRESET_WINDOW_DAYS: Record<string, number> = {
  [ReportRangePresetEnum.LAST_7_DAYS]: 7,
  [ReportRangePresetEnum.LAST_30_DAYS]: 30,
  [ReportRangePresetEnum.LAST_90_DAYS]: 90,
};

export interface ReportRange {
  preset: ReportRangePreset;
  fromDate: string | null;
  toDate: string | null;
}

export interface ReportWindowResult {
  windowStart: string;
  windowEnd: string;
}

interface CalendarRange {
  startDate: CalendarDate;
  endDate: CalendarDate;
}

export function buildToday(): CalendarDate {
  return today(VIETNAM_TIME_ZONE);
}

function buildCustomRange(range: ReportRange, todayDate: CalendarDate): CalendarRange {
  const { fromDate, toDate } = range;

  if (isNull(fromDate) || isNull(toDate)) {
    return buildRelativeRange(ReportRangePresetEnum.LAST_30_DAYS, todayDate);
  }

  return { startDate: parseDate(fromDate), endDate: parseDate(toDate) };
}

function buildRelativeRange(preset: ReportRangePreset, todayDate: CalendarDate): CalendarRange {
  if (preset === ReportRangePresetEnum.THIS_MONTH) {
    return { startDate: startOfMonth(todayDate), endDate: todayDate };
  }

  if (preset === ReportRangePresetEnum.LAST_MONTH) {
    const startDate = startOfMonth(todayDate.subtract({ months: 1 }));

    return { startDate, endDate: startOfMonth(todayDate).subtract({ days: 1 }) };
  }

  const { [preset]: windowDays = 30 } = PRESET_WINDOW_DAYS;

  return { startDate: todayDate.subtract({ days: windowDays }), endDate: todayDate };
}

function toIsoStartOfDay(date: CalendarDate): string {
  return date.toDate(VIETNAM_TIME_ZONE).toISOString();
}

export function buildReportWindow(range: ReportRange, todayDate: CalendarDate): ReportWindowResult {
  const { preset } = range;

  const { startDate, endDate } =
    preset === ReportRangePresetEnum.CUSTOM
      ? buildCustomRange(range, todayDate)
      : buildRelativeRange(preset, todayDate);

  return {
    windowStart: toIsoStartOfDay(startDate),
    windowEnd: toIsoStartOfDay(endDate.add({ days: 1 })),
  };
}

export function buildReportRangeLabel(range: ReportRange): string {
  const { preset, fromDate, toDate } = range;

  if (preset === ReportRangePresetEnum.CUSTOM && !isNull(fromDate) && !isNull(toDate)) {
    return `${formatDate(toIsoStartOfDay(parseDate(fromDate)))} – ${formatDate(toIsoStartOfDay(parseDate(toDate)))}`;
  }

  const { [preset]: label } = REPORT_RANGE_LABELS;

  return label;
}
