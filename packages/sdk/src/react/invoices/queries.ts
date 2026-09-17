import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { GetCreditNotesQuery, GetInvoicesQuery } from '@type/contracts.types';

export function useUpcomingInvoiceQuery(
  subscriptionId: string,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.invoice.upcoming({ subscriptionId }),
    enabled: enabled && Boolean(subscriptionId),
  });
}

export function useInvoicesQuery(
  query?: GetInvoicesQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.invoice.invoices(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useInvoiceQuery(invoiceId: string, { enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.invoice.invoice(invoiceId), enabled });
}

export function useCreditNotesQuery(
  query?: GetCreditNotesQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.invoice.creditNotes(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}
