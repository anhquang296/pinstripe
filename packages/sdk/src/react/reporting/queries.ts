import type { QueryProps } from '@react/react-query.types';
import { useVxrErpQueries } from '@react/vxr-erp.provider';
import { useQuery } from '@tanstack/react-query';
import type {
  AggregateReconciliationReportQuery,
  AggregateRevenueSummaryQuery,
} from '@type/contracts.types';

export function useRevenueSummaryQuery(
  query?: AggregateRevenueSummaryQuery,
  { enabled = true }: QueryProps = {},
) {
  const queries = useVxrErpQueries();

  return useQuery({ ...queries.reporting.revenue(query), enabled });
}

export function useReconciliationReportQuery(
  query: AggregateReconciliationReportQuery,
  { enabled = true }: QueryProps = {},
) {
  const queries = useVxrErpQueries();

  return useQuery({ ...queries.reporting.reconciliation(query), enabled });
}
