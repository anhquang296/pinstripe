import { createQueryKeys } from '@lukemorales/query-key-factory';
import type { GetEntitlementsQuery } from '@pinstripe/core/contracts';
import { getEntitlements } from '@api/entitlements/entitlements.api';
import { ReactQuerySubjectEnum } from '@react-query-keys/react-query-subject';

export const entitlementQueries = createQueryKeys(ReactQuerySubjectEnum.ENTITLEMENT, {
  entitlements: (query?: GetEntitlementsQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getEntitlements(query);
      },
    };
  },
});
