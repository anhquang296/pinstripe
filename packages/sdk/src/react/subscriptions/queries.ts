import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindSubscriptionItemsQuery, FindSubscriptionsQuery } from '@type/contracts.types';

export function useSubscriptionsQuery(
  query?: FindSubscriptionsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.subscription.subscriptions(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useSubscriptionQuery(subscriptionId: string, { enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.subscription.subscription(subscriptionId), enabled });
}

export function useSubscriptionItemsQuery(
  query: FindSubscriptionItemsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.subscription.subscriptionItems(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useSubscriptionItemQuery(
  subscriptionItemId: string,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.subscription.subscriptionItem(subscriptionItemId),
    enabled: enabled && Boolean(subscriptionItemId),
  });
}
