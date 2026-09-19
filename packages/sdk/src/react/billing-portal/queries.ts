import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindBillingPortalConfigurationsQuery } from '@type/contracts.types';

export function useBillingPortalConfigurationsQuery(
  query?: FindBillingPortalConfigurationsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.billing_portal.configurations(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useBillingPortalConfigurationQuery(
  configurationId: string,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.billing_portal.configuration(configurationId),
    enabled: enabled && Boolean(configurationId),
  });
}

export function useBillingPortalSessionQuery(
  sessionId: string,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.billing_portal.session(sessionId),
    enabled: enabled && Boolean(sessionId),
  });
}
