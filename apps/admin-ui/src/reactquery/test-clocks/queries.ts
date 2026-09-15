import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { GetTestClocksQuery } from '@pinstripe/core/contracts';
import type { QueryProps } from '@lib/react-query.types';
import { queries } from '@react-query-keys/index';

export function useTestClocksQuery(
  query?: GetTestClocksQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.test_clock.testClocks(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}
