import type { QueryProps } from '@react/react-query.types';
import { useVxrErpQueries } from '@react/vxr-erp.provider';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindMetersQuery, GetMeterEventSummaryQuery } from '@type/contracts.types';

export function useMetersQuery(
  query?: FindMetersQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = useVxrErpQueries();

  return useQuery({
    ...queries.meter.meters(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useMeterQuery(meterId: string, { enabled = true }: QueryProps = {}) {
  const queries = useVxrErpQueries();

  return useQuery({ ...queries.meter.meter(meterId), enabled });
}

export function useMeterEventSummaryQuery(
  meterId: string,
  query: GetMeterEventSummaryQuery,
  { enabled = true }: QueryProps = {},
) {
  const queries = useVxrErpQueries();

  return useQuery({ ...queries.meter.eventSummary(meterId, query), enabled });
}
