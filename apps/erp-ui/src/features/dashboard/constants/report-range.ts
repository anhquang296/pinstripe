import { dashboardPaths } from '@features/dashboard/routes/paths';
import { some, startsWith } from 'lodash-es';

const REPORT_RANGE_PATHS = [
  dashboardPaths.OVERVIEW,
  dashboardPaths.REPORTS,
  dashboardPaths.SUBSCRIPTIONS_USAGE,
];

export function hasReportRange(pathname: string): boolean {
  return some(REPORT_RANGE_PATHS, (reportRangePath) => {
    if (pathname === reportRangePath) {
      return true;
    }

    return (
      reportRangePath !== dashboardPaths.OVERVIEW && startsWith(pathname, `${reportRangePath}/`)
    );
  });
}
