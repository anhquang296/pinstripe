import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindWebhookDeliveriesQuery, FindWebhookEndpointsQuery } from '@type/contracts.types';

export function createWebhookQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.WEBHOOK, {
    endpoints: (query?: FindWebhookEndpointsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.webhookEndpoints.find(query);
        },
      };
    },
    endpoint: (webhookEndpointId: string) => {
      return {
        queryKey: [webhookEndpointId],
        queryFn: () => {
          return client.webhookEndpoints.get(webhookEndpointId);
        },
      };
    },
    deliveries: (query?: FindWebhookDeliveriesQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.webhookDeliveries.find(query);
        },
      };
    },
  });
}
