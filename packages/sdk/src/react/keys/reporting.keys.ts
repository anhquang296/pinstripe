import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type {
  AggregateReconciliationReportQuery,
  AggregateRevenueSummaryQuery,
} from '@type/contracts.types';

export function createReportingQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.REPORTING, {
    revenue: (query?: AggregateRevenueSummaryQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.reporting.getRevenueSummary(query);
        },
      };
    },
    reconciliation: (query: AggregateReconciliationReportQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.reporting.getReconciliationReport(query);
        },
      };
    },
  });
}
