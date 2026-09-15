import type { QueryProps } from '@lib/react-query.types';
import type { GetPricesQuery } from '@pinstripe/core/contracts';
import { queries } from '@react-query-keys/index';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export function usePricesQuery(
  query?: GetPricesQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.price.prices(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}
