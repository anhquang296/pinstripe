import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { useQuery } from '@tanstack/react-query';

export function useAccountQuery({ enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.account.account, enabled });
}
