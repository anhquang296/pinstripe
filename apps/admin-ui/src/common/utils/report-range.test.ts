import {
  buildReportRangeLabel,
  buildReportWindow,
  ReportRangePresetEnum,
} from '@common/utils/report-range';
import { CalendarDate } from '@internationalized/date';
import { describe, expect, it } from 'vitest';

function setup(overrides: Partial<Parameters<typeof buildReportWindow>[0]> = {}) {
  return {
    preset: ReportRangePresetEnum.LAST_30_DAYS,
    fromDate: null,
    toDate: null,
    ...overrides,
  };
}

describe('buildReportWindow', () => {
  it.each([
    {
      preset: ReportRangePresetEnum.LAST_7_DAYS,
      windowStart: '2026-09-13T00:00:00+07:00',
      windowEnd: '2026-09-21T00:00:00+07:00',
    },
    {
      preset: ReportRangePresetEnum.LAST_30_DAYS,
      windowStart: '2026-08-21T00:00:00+07:00',
      windowEnd: '2026-09-21T00:00:00+07:00',
    },
    {
      preset: ReportRangePresetEnum.LAST_90_DAYS,
      windowStart: '2026-06-22T00:00:00+07:00',
      windowEnd: '2026-09-21T00:00:00+07:00',
    },
    {
      preset: ReportRangePresetEnum.THIS_MONTH,
      windowStart: '2026-09-01T00:00:00+07:00',
      windowEnd: '2026-09-21T00:00:00+07:00',
    },
    {
      preset: ReportRangePresetEnum.LAST_MONTH,
      windowStart: '2026-08-01T00:00:00+07:00',
      windowEnd: '2026-09-01T00:00:00+07:00',
    },
  ])(
    'resolves $preset against 20/09/2026 to a window whose end is exclusive',
    ({ preset, windowStart, windowEnd }) => {
      const result = buildReportWindow(setup({ preset }), new CalendarDate(2026, 9, 20));

      expect(result).toEqual({
        windowStart: new Date(windowStart).toISOString(),
        windowEnd: new Date(windowEnd).toISOString(),
      });
    },
  );

  it('anchors the window to midnight in Vietnam, not to the runner timezone', () => {
    const result = buildReportWindow(setup(), new CalendarDate(2026, 9, 20));

    expect(result.windowStart).toBe('2026-08-20T17:00:00.000Z');
    expect(result.windowEnd).toBe('2026-09-20T17:00:00.000Z');
  });

  it('spans exactly one day when a custom range starts and ends on the same date', () => {
    const range = setup({
      preset: ReportRangePresetEnum.CUSTOM,
      fromDate: '2026-09-20',
      toDate: '2026-09-20',
    });

    const result = buildReportWindow(range, new CalendarDate(2026, 9, 20));

    expect(result).toEqual({
      windowStart: new Date('2026-09-20T00:00:00+07:00').toISOString(),
      windowEnd: new Date('2026-09-21T00:00:00+07:00').toISOString(),
    });
  });

  it('falls back to the last 30 days when a custom range has no dates yet', () => {
    const range = setup({ preset: ReportRangePresetEnum.CUSTOM });

    const result = buildReportWindow(range, new CalendarDate(2026, 9, 20));

    expect(result).toEqual(buildReportWindow(setup(), new CalendarDate(2026, 9, 20)));
  });

  it('crosses the year boundary for the previous month', () => {
    const range = setup({ preset: ReportRangePresetEnum.LAST_MONTH });

    const result = buildReportWindow(range, new CalendarDate(2026, 1, 5));

    expect(result).toEqual({
      windowStart: new Date('2025-12-01T00:00:00+07:00').toISOString(),
      windowEnd: new Date('2026-01-01T00:00:00+07:00').toISOString(),
    });
  });
});

describe('buildReportRangeLabel', () => {
  it('names the preset when the range is relative', () => {
    expect(buildReportRangeLabel(setup())).toBe('30 ngày gần nhất');
  });

  it('shows both dates in Vietnamese format when the range is custom', () => {
    const range = setup({
      preset: ReportRangePresetEnum.CUSTOM,
      fromDate: '2026-08-01',
      toDate: '2026-09-20',
    });

    expect(buildReportRangeLabel(range)).toBe('01/08/2026 – 20/09/2026');
  });

  it('names the custom preset when its dates are not set', () => {
    expect(buildReportRangeLabel(setup({ preset: ReportRangePresetEnum.CUSTOM }))).toBe('Tuỳ chọn');
  });
});
