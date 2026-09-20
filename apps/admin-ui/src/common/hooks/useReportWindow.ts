import type { ReportWindowResult } from '@common/utils/report-range';
import { buildReportRangeLabel, buildReportWindow, buildToday } from '@common/utils/report-range';
import { useReportRangeStore } from '@libs/report-range.store';
import { useMemo } from 'react';

export type { ReportWindowResult };

export function useReportWindow(): ReportWindowResult {
  const preset = useReportRangeStore((state) => {
    return state.preset;
  });

  const fromDate = useReportRangeStore((state) => {
    return state.fromDate;
  });

  const toDate = useReportRangeStore((state) => {
    return state.toDate;
  });

  return useMemo(() => {
    return buildReportWindow({ preset, fromDate, toDate }, buildToday());
  }, [preset, fromDate, toDate]);
}

export function useReportRangeLabel(): string {
  const preset = useReportRangeStore((state) => {
    return state.preset;
  });

  const fromDate = useReportRangeStore((state) => {
    return state.fromDate;
  });

  const toDate = useReportRangeStore((state) => {
    return state.toDate;
  });

  return buildReportRangeLabel({ preset, fromDate, toDate });
}
