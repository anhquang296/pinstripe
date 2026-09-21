import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindTestClocksQuery } from '@type/contracts.types';

export function createTestClockQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.TEST_CLOCK, {
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
