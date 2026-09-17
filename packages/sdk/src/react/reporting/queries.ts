import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { useQuery } from '@tanstack/react-query';
import type { GetReconciliationReportQuery, GetRevenueSummaryQuery } from '@type/contracts.types';

export function useRevenueSummaryQuery(
  query?: GetRevenueSummaryQuery,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.reporting.revenue(query), enabled });
}

export function useReconciliationReportQuery(
  query: GetReconciliationReportQuery,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.reporting.reconciliation(query), enabled });
}
