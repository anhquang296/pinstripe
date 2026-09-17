import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindCustomersQuery } from '@type/contracts.types';

export function useCustomersQuery(
  query?: FindCustomersQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.customer.customers(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useCustomerQuery(customerId: string, { enabled = true }: QueryProps = {}) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.customer.customer(customerId), enabled });
}
