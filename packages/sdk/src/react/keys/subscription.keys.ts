import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindSubscriptionItemsQuery, FindSubscriptionsQuery } from '@type/contracts.types';

export function createSubscriptionQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.SUBSCRIPTION, {
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
    subscriptionItems: (query: FindSubscriptionItemsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.subscriptionItems.find(query);
        },
      };
    },
    subscriptionItem: (subscriptionItemId: string) => {
      return {
        queryKey: [subscriptionItemId],
        queryFn: () => {
          return client.subscriptionItems.get(subscriptionItemId);
        },
      };
    },
  });
}
