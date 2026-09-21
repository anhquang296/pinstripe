import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';

export function createAccountQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.ACCOUNT, {
    account: {
      queryKey: null,
      queryFn: () => {
        return client.account.get();
      },
    },
  });
}
