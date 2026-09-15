import { getUpcomingInvoice } from '@api/invoices';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import type { GetUpcomingInvoiceQuery } from '@pinstripe/core/contracts';
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
});
