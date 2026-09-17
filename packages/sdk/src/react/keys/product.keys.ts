import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { GetProductsQuery } from '@type/contracts.types';

export function createProductQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.PRODUCT, {
    products: (query?: GetProductsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.products.list(query);
        },
      };
    },
    product: (productId: string) => {
      return {
        queryKey: [productId],
        queryFn: () => {
          return client.products.retrieve(productId);
        },
      };
    },
  });
}
