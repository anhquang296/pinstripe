import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindTestClocksQuery } from '@type/contracts.types';

export function useTestClocksQuery(
  query?: FindTestClocksQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.test_clock.testClocks(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useTestClockQuery(testClockId: string, { enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.test_clock.testClock(testClockId),
    enabled: enabled && Boolean(testClockId),
  });
}
