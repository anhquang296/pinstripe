import type { GetMeterEventSummariesQuery, GetMetersQuery } from '@api/meters';
import type { QueryProps } from '@lib/react-query.types';
import { queries } from '@react-query-keys/index';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export function useMetersQuery(
  query?: GetMetersQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.meter.meters(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useMeterEventSummaryQuery(
  meterId: string,
  query: GetMeterEventSummariesQuery,
  { enabled = true }: QueryProps = {},
) {
  return useQuery({ ...queries.meter.eventSummary(meterId, query), enabled });
}
