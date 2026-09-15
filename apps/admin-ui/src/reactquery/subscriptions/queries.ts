import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { GetSubscriptionsQuery } from '@pinstripe/core/contracts';
import type { QueryProps } from '@lib/react-query.types';
import { queries } from '@react-query-keys/index';

export function useSubscriptionsQuery(
  query?: GetSubscriptionsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.subscription.subscriptions(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}
