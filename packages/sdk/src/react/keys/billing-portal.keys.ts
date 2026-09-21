import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindBillingPortalConfigurationsQuery } from '@type/contracts.types';

export function createBillingPortalQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.BILLING_PORTAL, {
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
