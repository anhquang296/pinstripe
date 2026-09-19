import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { useQuery } from '@tanstack/react-query';
import type { FindPortalMembershipsQuery } from '@type/contracts.types';

export function usePortalMembershipsQuery(
  query: FindPortalMembershipsQuery,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.portal_membership.portalMemberships(query), enabled });
}
