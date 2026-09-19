import { MILLISECONDS_PER_DAY } from '@constants/time';
import { useMemo } from 'react';

export interface ReportWindowResult {
  windowStart: string;
  windowEnd: string;
}

function buildReportWindow(windowDays: number): ReportWindowResult {
  const now = Date.now();

  return {
    windowStart: new Date(now - windowDays * MILLISECONDS_PER_DAY).toISOString(),
    windowEnd: new Date(now + MILLISECONDS_PER_DAY).toISOString(),
  };
}

export function useReportWindow(windowDays: number): ReportWindowResult {
  return useMemo(() => {
    return buildReportWindow(windowDays);
  }, [windowDays]);
}
