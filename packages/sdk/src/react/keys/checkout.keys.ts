import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindCheckoutSessionsQuery } from '@type/contracts.types';

export function createCheckoutQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.CHECKOUT, {
    sessions: (query?: FindCheckoutSessionsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.checkout.sessions.find(query);
        },
      };
    },
    session: (checkoutSessionId: string) => {
      return {
        queryKey: [checkoutSessionId],
        queryFn: () => {
          return client.checkout.sessions.get(checkoutSessionId);
        },
      };
    },
  });
}
