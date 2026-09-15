import type { QueryProps } from '@lib/react-query.types';
import type { GetProductsQuery } from '@pinstripe/core/contracts';
import { queries } from '@react-query-keys/index';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export function useProductsQuery(
  query?: GetProductsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.product.products(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useProductQuery(productId: string, { enabled = true }: QueryProps = {}) {
  return useQuery({ ...queries.product.product(productId), enabled });
}
