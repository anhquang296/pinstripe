import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { GetCustomersQuery } from '@pinstripe/core/contracts';
import type { QueryProps } from '@lib/react-query.types';
import { queries } from '@react-query-keys/index';

export function useCustomersQuery(
  query?: GetCustomersQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.customer.customers(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useCustomerQuery(customerId: string, { enabled = true }: QueryProps = {}) {
  return useQuery({ ...queries.customer.customer(customerId), enabled });
}
