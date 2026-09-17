import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { GetTestClocksQuery } from '@type/contracts.types';

export function createTestClockQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.TEST_CLOCK, {
    testClocks: (query?: GetTestClocksQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.testHelpers.testClocks.list(query);
        },
      };
    },
  });
}
