import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindBillingPortalConfigurationsQuery } from '@type/contracts.types';

export function createBillingPortalQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.BILLING_PORTAL, {
    configurations: (query?: FindBillingPortalConfigurationsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.billingPortal.configurations.find(query);
        },
      };
    },
    configuration: (configurationId: string) => {
      return {
        queryKey: [configurationId],
        queryFn: () => {
          return client.billingPortal.configurations.get(configurationId);
        },
      };
    },
    session: (sessionId: string) => {
      return {
        queryKey: [sessionId],
        queryFn: () => {
          return client.billingPortal.sessions.get(sessionId);
        },
      };
    },
  });
}
