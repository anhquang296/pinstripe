import type { QueryProps } from '@lib/react-query.types';
import type {
  GetWebhookDeliveriesQuery,
  GetWebhookEndpointsQuery,
} from '@pinstripe/core/contracts';
import { queries } from '@react-query-keys/index';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export function useWebhookEndpointsQuery(
  query?: GetWebhookEndpointsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.webhook.endpoints(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useWebhookDeliveriesQuery(
  query?: GetWebhookDeliveriesQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.webhook.deliveries(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}
