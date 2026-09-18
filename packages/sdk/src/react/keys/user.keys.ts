import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindUsersQuery } from '@type/contracts.types';

export function createUserQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.USER, {
    users: (query?: FindUsersQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.admin.users.find(query);
        },
      };
    },
    user: (userId: string) => {
      return {
        queryKey: [userId],
        queryFn: () => {
          return client.admin.users.get(userId);
        },
      };
    },
  });
}
