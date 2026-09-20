import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindApiKeysQuery } from '@type/contracts.types';

export function createApiKeyQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.API_KEY, {
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
