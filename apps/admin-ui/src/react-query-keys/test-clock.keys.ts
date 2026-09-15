import { createQueryKeys } from '@lukemorales/query-key-factory';
import type { GetTestClocksQuery } from '@pinstripe/core/contracts';
import { getTestClocks } from '@api/test-clocks/test-clocks.api';
import { ReactQuerySubjectEnum } from '@react-query-keys/react-query-subject';

export const testClockQueries = createQueryKeys(ReactQuerySubjectEnum.TEST_CLOCK, {
  testClocks: (query?: GetTestClocksQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getTestClocks(query);
      },
    };
  },
});
