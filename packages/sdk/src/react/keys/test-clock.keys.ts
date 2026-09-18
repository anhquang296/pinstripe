import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindTestClocksQuery } from '@type/contracts.types';

export function createTestClockQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.TEST_CLOCK, {
    testClocks: (query?: FindTestClocksQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.testHelpers.testClocks.find(query);
        },
      };
    },
    testClock: (testClockId: string) => {
      return {
        queryKey: [testClockId],
        queryFn: () => {
          return client.testHelpers.testClocks.get(testClockId);
        },
      };
    },
  });
}
