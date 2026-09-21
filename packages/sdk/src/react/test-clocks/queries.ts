import type { QueryProps } from '@react/react-query.types';
import { useVxrErpQueries } from '@react/vxr-erp.provider';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindTestClocksQuery } from '@type/contracts.types';

export function useTestClocksQuery(
  query?: FindTestClocksQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = useVxrErpQueries();

  return useQuery({
    ...queries.test_clock.testClocks(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useTestClockQuery(testClockId: string, { enabled = true }: QueryProps = {}) {
  const queries = useVxrErpQueries();

  return useQuery({
    ...queries.test_clock.testClock(testClockId),
    enabled: enabled && Boolean(testClockId),
  });
}
