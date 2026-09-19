import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { useQuery } from '@tanstack/react-query';

export function usePortalAccountQuery({ enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.portal.account, enabled });
}
