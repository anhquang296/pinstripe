import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { GetSubscriptionsQuery } from '@type/contracts.types';

export function createSubscriptionQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.SUBSCRIPTION, {
    subscriptions: (query?: GetSubscriptionsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.subscriptions.list(query);
        },
      };
    },
    subscription: (subscriptionId: string) => {
      return {
        queryKey: [subscriptionId],
        queryFn: () => {
          return client.subscriptions.retrieve(subscriptionId);
        },
      };
    },
  });
}
