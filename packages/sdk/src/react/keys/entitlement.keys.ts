import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { GetEntitlementsQuery } from '@type/contracts.types';

export function createEntitlementQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.ENTITLEMENT, {
    entitlements: (query?: GetEntitlementsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.entitlements.list(query);
        },
      };
    },
  });
}
