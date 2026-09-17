import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { GetMeterEventSummariesQuery, GetMetersQuery } from '@type/contracts.types';

export function useMetersQuery(
  query?: GetMetersQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.meter.meters(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useMeterQuery(meterId: string, { enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.meter.meter(meterId), enabled });
}

export function useMeterEventSummaryQuery(
  meterId: string,
  query: GetMeterEventSummariesQuery,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.meter.eventSummary(meterId, query), enabled });
}
