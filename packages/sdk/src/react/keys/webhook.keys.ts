import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindWebhookDeliveriesQuery, FindWebhookEndpointsQuery } from '@type/contracts.types';

export function createWebhookQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.WEBHOOK, {
    endpoints: (query?: FindWebhookEndpointsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.webhookEndpoints.list(query);
        },
      };
    },
    deliveries: (query?: FindWebhookDeliveriesQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.webhookDeliveries.list(query);
        },
      };
    },
  });
}
