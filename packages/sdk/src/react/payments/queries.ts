import type { QueryProps } from '@react/react-query.types';
import { useVxrErpQueries } from '@react/vxr-erp.provider';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindPaymentIntentsQuery, FindRefundsQuery } from '@type/contracts.types';

export function usePaymentIntentsQuery(
  query?: FindPaymentIntentsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = useVxrErpQueries();

  return useQuery({
    ...queries.payment.paymentIntents(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function usePaymentIntentQuery(
  paymentIntentId: string,
  { enabled = true }: QueryProps = {},
) {
  const queries = useVxrErpQueries();

  return useQuery({
    ...queries.payment.paymentIntent(paymentIntentId),
    enabled: enabled && Boolean(paymentIntentId),
  });
}

export function useRefundsQuery(
  query?: FindRefundsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = useVxrErpQueries();

  return useQuery({
    ...queries.payment.refunds(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useRefundQuery(refundId: string, { enabled = true }: QueryProps = {}) {
  const queries = useVxrErpQueries();

  return useQuery({
    ...queries.payment.refund(refundId),
    enabled: enabled && Boolean(refundId),
  });
}
