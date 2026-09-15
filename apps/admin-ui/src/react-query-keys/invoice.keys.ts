import { getCreditNotes } from '@api/credit-notes';
import { getInvoice, getInvoices, getUpcomingInvoice } from '@api/invoices';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import type {
  GetCreditNotesQuery,
  GetInvoicesQuery,
  GetUpcomingInvoiceQuery,
} from '@pinstripe/core/contracts';
import { ReactQuerySubjectEnum } from '@react-query-keys/react-query-subject';

export const invoiceQueries = createQueryKeys(ReactQuerySubjectEnum.INVOICE, {
  upcoming: (query: GetUpcomingInvoiceQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getUpcomingInvoice(query);
      },
    };
  },
  invoices: (query?: GetInvoicesQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getInvoices(query);
      },
    };
  },
  invoice: (invoiceId: string) => {
    return {
      queryKey: [invoiceId],
      queryFn: () => {
        return getInvoice(invoiceId);
      },
    };
  },
  creditNotes: (query?: GetCreditNotesQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getCreditNotes(query);
      },
    };
  },
});
