import type { QueryProps } from '@lib/react-query.types';
import { queries } from '@react-query-keys/index';
import { useQuery } from '@tanstack/react-query';

export function useUpcomingInvoiceQuery(
  subscriptionId: string,
  { enabled = true }: QueryProps = {},
) {
  return useQuery({
    ...queries.invoice.upcoming({ subscriptionId }),
    enabled: enabled && Boolean(subscriptionId),
  });
}
