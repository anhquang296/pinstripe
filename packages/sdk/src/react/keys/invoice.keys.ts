import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type {
  FindCreditNotesQuery,
  FindInvoiceItemsQuery,
  FindInvoicesQuery,
  GetUpcomingInvoiceQuery,
} from '@type/contracts.types';

export function createInvoiceQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.INVOICE, {
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
    invoiceItems: (query?: FindInvoiceItemsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.invoiceItems.find(query);
        },
      };
    },
    invoiceItem: (invoiceItemId: string) => {
      return {
        queryKey: [invoiceItemId],
        queryFn: () => {
          return client.invoiceItems.get(invoiceItemId);
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
    creditNote: (creditNoteId: string) => {
      return {
        queryKey: [creditNoteId],
        queryFn: () => {
          return client.creditNotes.get(creditNoteId);
        },
      };
    },
  });
}
