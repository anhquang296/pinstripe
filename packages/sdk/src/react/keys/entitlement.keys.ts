import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindEntitlementsQuery } from '@type/contracts.types';

export function createEntitlementQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.ENTITLEMENT, {
    entitlements: (query?: FindEntitlementsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.entitlements.find(query);
        },
      };
    },
  });
}
