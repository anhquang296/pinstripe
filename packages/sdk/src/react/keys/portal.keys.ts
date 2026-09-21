import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type {
  FindPortalInvoicesQuery,
  FindPortalPaymentMethodsQuery,
  FindPortalPaymentsQuery,
  FindPortalSubscriptionsQuery,
} from '@type/contracts.types';

export function createPortalQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.PORTAL, {
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
    invoiceComparison: (invoiceId: string) => {
      return {
        queryKey: [invoiceId],
        queryFn: () => {
          return client.portal.invoiceComparisons.get(invoiceId);
        },
      };
    },
    invoiceReminders: (invoiceId: string) => {
      return {
        queryKey: [invoiceId],
        queryFn: () => {
          return client.portal.invoiceReminders.find(invoiceId);
        },
      };
    },
    usage: {
      queryKey: null,
      queryFn: () => {
        return client.portal.usage.find();
      },
    },
    bankTransfer: (invoiceId: string) => {
      return {
        queryKey: [invoiceId],
        queryFn: () => {
          return client.portal.bankTransfers.get(invoiceId);
        },
      };
    },
    payments: (query?: FindPortalPaymentsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.portal.payments.find(query);
        },
      };
    },
    paymentMethods: (query?: FindPortalPaymentMethodsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.portal.paymentMethods.find(query);
        },
      };
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
