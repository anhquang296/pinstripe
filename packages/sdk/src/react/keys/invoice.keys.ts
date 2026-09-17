import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type {
  FindCreditNotesQuery,
  FindInvoicesQuery,
  GetUpcomingInvoiceQuery,
} from '@type/contracts.types';

export function createInvoiceQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.INVOICE, {
    upcoming: (query: GetUpcomingInvoiceQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.invoices.getUpcoming(query);
        },
      };
    },
    invoices: (query?: FindInvoicesQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.invoices.find(query);
        },
      };
    },
    invoice: (invoiceId: string) => {
      return {
        queryKey: [invoiceId],
        queryFn: () => {
          return client.invoices.get(invoiceId);
        },
      };
    },
    creditNotes: (query?: FindCreditNotesQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.creditNotes.find(query);
        },
      };
    },
  });
}
