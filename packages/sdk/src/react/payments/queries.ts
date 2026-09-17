import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindPaymentIntentsQuery, FindRefundsQuery } from '@type/contracts.types';

export function usePaymentIntentsQuery(
  query?: FindPaymentIntentsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.payment.paymentIntents(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useRefundsQuery(
  query?: FindRefundsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.payment.refunds(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}
