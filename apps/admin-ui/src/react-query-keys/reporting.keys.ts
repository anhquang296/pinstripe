import { getReconciliationReport, getRevenueSummary } from '@api/reporting';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import type {
  GetReconciliationReportQuery,
  GetRevenueSummaryQuery,
} from '@pinstripe/core/contracts';
import { ReactQuerySubjectEnum } from '@react-query-keys/react-query-subject';

export const reportingQueries = createQueryKeys(ReactQuerySubjectEnum.REPORTING, {
  revenue: (query?: GetRevenueSummaryQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getRevenueSummary(query);
      },
    };
  },
  reconciliation: (query: GetReconciliationReportQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getReconciliationReport(query);
      },
    };
  },
});
