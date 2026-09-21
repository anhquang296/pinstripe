import type { QueryProps } from '@react/react-query.types';
import { useVxrErpQueries } from '@react/vxr-erp.provider';
import { useQuery } from '@tanstack/react-query';
import type { FindPortalMembershipsQuery } from '@type/contracts.types';

export function usePortalMembershipsQuery(
  query: FindPortalMembershipsQuery,
  { enabled = true }: QueryProps = {},
) {
  const queries = useVxrErpQueries();

  return useQuery({ ...queries.portal_membership.portalMemberships(query), enabled });
}
