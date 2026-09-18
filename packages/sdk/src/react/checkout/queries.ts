import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindCheckoutSessionsQuery } from '@type/contracts.types';

export function useCheckoutSessionsQuery(
  query?: FindCheckoutSessionsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.checkout.sessions(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useCheckoutSessionQuery(
  checkoutSessionId: string,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.checkout.session(checkoutSessionId),
    enabled: enabled && Boolean(checkoutSessionId),
  });
}
