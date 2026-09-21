import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindPortalMembershipsQuery } from '@type/contracts.types';

export function createPortalMembershipQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.PORTAL_MEMBERSHIP, {
    portalMemberships: (query: FindPortalMembershipsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.portalMemberships.find(query);
        },
      };
    },
  });
}
