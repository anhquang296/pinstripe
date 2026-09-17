import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindSubscriptionsQuery } from '@type/contracts.types';

export function createSubscriptionQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.SUBSCRIPTION, {
    subscriptions: (query?: FindSubscriptionsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.subscriptions.find(query);
        },
      };
    },
    subscription: (subscriptionId: string) => {
      return {
        queryKey: [subscriptionId],
        queryFn: () => {
          return client.subscriptions.get(subscriptionId);
        },
      };
    },
  });
}
