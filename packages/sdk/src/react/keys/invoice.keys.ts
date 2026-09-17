import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type {
  GetCreditNotesQuery,
  GetInvoicesQuery,
  GetUpcomingInvoiceQuery,
} from '@type/contracts.types';

export function createInvoiceQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.INVOICE, {
    upcoming: (query: GetUpcomingInvoiceQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.invoices.retrieveUpcoming(query);
        },
      };
    },
    invoices: (query?: GetInvoicesQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.invoices.list(query);
        },
      };
    },
    invoice: (invoiceId: string) => {
      return {
        queryKey: [invoiceId],
        queryFn: () => {
          return client.invoices.retrieve(invoiceId);
        },
      };
    },
    creditNotes: (query?: GetCreditNotesQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.creditNotes.list(query);
        },
      };
    },
  });
}
