import { createQueryKeys } from '@lukemorales/query-key-factory';
import type { GetSubscriptionsQuery } from '@pinstripe/core/contracts';
import { getSubscription, getSubscriptions } from '@api/subscriptions/subscriptions.api';
import { ReactQuerySubjectEnum } from '@react-query-keys/react-query-subject';

export const subscriptionQueries = createQueryKeys(ReactQuerySubjectEnum.SUBSCRIPTION, {
  subscriptions: (query?: GetSubscriptionsQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getSubscriptions(query);
      },
    };
  },
  subscription: (subscriptionId: string) => {
    return {
      queryKey: [subscriptionId],
      queryFn: () => {
        return getSubscription(subscriptionId);
      },
    };
  },
});
