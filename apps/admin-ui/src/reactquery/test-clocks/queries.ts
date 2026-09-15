import type { QueryProps } from '@lib/react-query.types';
import type { GetTestClocksQuery } from '@pinstripe/core/contracts';
import { queries } from '@react-query-keys/index';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

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
