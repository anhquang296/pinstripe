import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';

export function createAccountQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.ACCOUNT, {
    account: {
      queryKey: null,
      queryFn: () => {
        return client.admin.account.get();
      },
    },
  });
}
