import type { QueryProps } from '@react/react-query.types';
import { useVxrErpQueries } from '@react/vxr-erp.provider';
import { useQuery } from '@tanstack/react-query';

export function useAccountQuery({ enabled = true }: QueryProps = {}) {
  const queries = useVxrErpQueries();

  return useQuery({ ...queries.account.account, enabled });
}
