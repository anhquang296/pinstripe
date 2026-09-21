import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindUsersQuery } from '@type/contracts.types';

export function createUserQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.USER, {
    users: (query?: FindUsersQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.users.find(query);
        },
      };
    },
    user: (userId: string) => {
      return {
        queryKey: [userId],
        queryFn: () => {
          return client.users.get(userId);
        },
      };
    },
  });
}
