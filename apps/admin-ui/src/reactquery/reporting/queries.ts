import type { QueryProps } from '@lib/react-query.types';
import type {
  GetReconciliationReportQuery,
  GetRevenueSummaryQuery,
} from '@pinstripe/core/contracts';
import { queries } from '@react-query-keys/index';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export function useRevenueSummaryQuery(
  query?: GetRevenueSummaryQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.reporting.revenue(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useReconciliationReportQuery(
  query: GetReconciliationReportQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.reporting.reconciliation(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}
