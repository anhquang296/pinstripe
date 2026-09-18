import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindPaymentLinksQuery } from '@type/contracts.types';

export function usePaymentLinksQuery(
  query?: FindPaymentLinksQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.payment_link.paymentLinks(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function usePaymentLinkQuery(paymentLinkId: string, { enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.payment_link.paymentLink(paymentLinkId),
    enabled: enabled && Boolean(paymentLinkId),
  });
}
