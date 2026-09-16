import { getWebhookDeliveries, getWebhookEndpoints } from '@api/webhooks';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import type {
  GetWebhookDeliveriesQuery,
  GetWebhookEndpointsQuery,
} from '@pinstripe/core/contracts';
import { ReactQuerySubjectEnum } from '@react-query-keys/react-query-subject';

export const webhookQueries = createQueryKeys(ReactQuerySubjectEnum.WEBHOOK, {
  endpoints: (query?: GetWebhookEndpointsQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getWebhookEndpoints(query);
      },
    };
  },
  deliveries: (query?: GetWebhookDeliveriesQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getWebhookDeliveries(query);
      },
    };
  },
});
