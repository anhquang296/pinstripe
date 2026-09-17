import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type {
  AggregateReconciliationReportQuery,
  AggregateRevenueSummaryQuery,
} from '@type/contracts.types';

export function createReportingQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.REPORTING, {
    revenue: (query?: AggregateRevenueSummaryQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.admin.reporting.getRevenueSummary(query);
        },
      };
    },
    reconciliation: (query: AggregateReconciliationReportQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.admin.reporting.getReconciliationReport(query);
        },
      };
    },
  });
}
