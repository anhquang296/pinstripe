import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindApiKeysQuery } from '@type/contracts.types';

export function createApiKeyQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.API_KEY, {
    apiKeys: (query?: FindApiKeysQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.apiKeys.find(query);
        },
      };
    },
  });
}
