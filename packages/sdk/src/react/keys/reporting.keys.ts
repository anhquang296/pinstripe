import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { GetReconciliationReportQuery, GetRevenueSummaryQuery } from '@type/contracts.types';

export function createReportingQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.REPORTING, {
    revenue: (query?: GetRevenueSummaryQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.admin.reporting.retrieveRevenueSummary(query);
        },
      };
    },
    reconciliation: (query: GetReconciliationReportQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.admin.reporting.retrieveReconciliationReport(query);
        },
      };
    },
  });
}
