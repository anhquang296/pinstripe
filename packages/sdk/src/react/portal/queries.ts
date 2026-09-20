import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  FindPortalInvoicesQuery,
  FindPortalPaymentMethodsQuery,
  FindPortalPaymentsQuery,
  FindPortalSubscriptionsQuery,
} from '@type/contracts.types';

export function usePortalAccountQuery({ enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.portal.account, enabled });
}

export function usePortalInvoicesQuery(
  query?: FindPortalInvoicesQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.portal.invoices(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function usePortalInvoiceQuery(invoiceId: string, { enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.portal.invoice(invoiceId), enabled });
}

export function usePortalInvoiceTotalsQuery({ enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.portal.invoiceTotals, enabled });
}

export function usePortalInvoiceComparisonQuery(
  invoiceId: string,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.portal.invoiceComparison(invoiceId), enabled });
}

export function usePortalInvoiceRemindersQuery(
  invoiceId: string,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.portal.invoiceReminders(invoiceId), enabled });
}

export function usePortalUsageQuery({ enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.portal.usage, enabled });
}

export function usePortalBankTransferQuery(invoiceId: string, { enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.portal.bankTransfer(invoiceId), enabled, retry: false });
}

export function usePortalPaymentsQuery(
  query?: FindPortalPaymentsQuery,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.portal.payments(query), enabled });
}

export function usePortalPaymentMethodsQuery(
  query?: FindPortalPaymentMethodsQuery,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.portal.paymentMethods(query), enabled });
}

export function usePortalSubscriptionsQuery(
  query?: FindPortalSubscriptionsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.portal.subscriptions(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}
