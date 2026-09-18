import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindWebhookDeliveriesQuery, FindWebhookEndpointsQuery } from '@type/contracts.types';

export function useWebhookEndpointsQuery(
  query?: FindWebhookEndpointsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.webhook.endpoints(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useWebhookEndpointQuery(
  webhookEndpointId: string,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.webhook.endpoint(webhookEndpointId),
    enabled: enabled && Boolean(webhookEndpointId),
  });
}

export function useWebhookDeliveriesQuery(
  query?: FindWebhookDeliveriesQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.webhook.deliveries(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}
