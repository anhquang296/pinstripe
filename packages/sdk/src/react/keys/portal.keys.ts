import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindPortalInvoicesQuery, FindPortalSubscriptionsQuery } from '@type/contracts.types';

export function createPortalQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.PORTAL, {
    account: {
      queryKey: null,
      queryFn: () => {
        return client.portal.account.get();
      },
    },
    invoices: (query?: FindPortalInvoicesQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.portal.invoices.find(query);
        },
      };
    },
    invoice: (invoiceId: string) => {
      return {
        queryKey: [invoiceId],
        queryFn: () => {
          return client.portal.invoices.get(invoiceId);
        },
      };
    },
    invoiceTotals: {
      queryKey: null,
      queryFn: () => {
        return client.portal.invoiceTotals.get();
      },
    },
    subscriptions: (query?: FindPortalSubscriptionsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.portal.subscriptions.find(query);
        },
      };
    },
  });
}
