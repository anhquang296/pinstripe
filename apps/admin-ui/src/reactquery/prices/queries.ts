import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { GetPricesQuery } from '@pinstripe/core/contracts';
import type { QueryProps } from '@lib/react-query.types';
import { queries } from '@react-query-keys/index';

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
