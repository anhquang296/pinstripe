import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { GetEntitlementsQuery } from '@pinstripe/core/contracts';
import type { QueryProps } from '@lib/react-query.types';
import { queries } from '@react-query-keys/index';

export function useEntitlementsQuery(
  query?: GetEntitlementsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.entitlement.entitlements(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}
