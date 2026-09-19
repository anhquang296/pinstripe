import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';

export function createPortalQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.PORTAL, {
    account: {
      queryKey: null,
      queryFn: () => {
        return client.portal.account.get();
      },
    },
  });
}
