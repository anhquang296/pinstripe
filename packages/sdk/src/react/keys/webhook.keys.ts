import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { GetWebhookDeliveriesQuery, GetWebhookEndpointsQuery } from '@type/contracts.types';

export function createWebhookQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.WEBHOOK, {
    endpoints: (query?: GetWebhookEndpointsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.webhookEndpoints.list(query);
        },
      };
    },
    deliveries: (query?: GetWebhookDeliveriesQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.webhookDeliveries.list(query);
        },
      };
    },
  });
}
