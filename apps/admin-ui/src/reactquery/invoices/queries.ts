import type { QueryProps } from '@lib/react-query.types';
import type { GetCreditNotesQuery, GetInvoicesQuery } from '@pinstripe/core/contracts';
import { queries } from '@react-query-keys/index';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export function useUpcomingInvoiceQuery(
  subscriptionId: string,
  { enabled = true }: QueryProps = {},
) {
  return useQuery({
    ...queries.invoice.upcoming({ subscriptionId }),
    enabled: enabled && Boolean(subscriptionId),
  });
}

export function useInvoicesQuery(
  query?: GetInvoicesQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.invoice.invoices(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useCreditNotesQuery(
  query?: GetCreditNotesQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.invoice.creditNotes(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}
