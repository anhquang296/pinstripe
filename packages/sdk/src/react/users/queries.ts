import type { QueryProps } from '@react/react-query.types';
import { useVxrErpQueries } from '@react/vxr-erp.provider';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindUsersQuery } from '@type/contracts.types';

export function useUsersQuery(
  query?: FindUsersQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = useVxrErpQueries();

  return useQuery({
    ...queries.user.users(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useUserQuery(userId: string, { enabled = true }: QueryProps = {}) {
  const queries = useVxrErpQueries();

  return useQuery({ ...queries.user.user(userId), enabled });
}
