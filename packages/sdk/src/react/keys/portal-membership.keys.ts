import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindPortalMembershipsQuery } from '@type/contracts.types';

export function createPortalMembershipQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.PORTAL_MEMBERSHIP, {
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
