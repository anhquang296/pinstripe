import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindCheckoutSessionsQuery } from '@type/contracts.types';

export function createCheckoutQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.CHECKOUT, {
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
