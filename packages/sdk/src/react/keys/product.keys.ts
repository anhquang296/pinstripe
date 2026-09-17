import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindProductsQuery } from '@type/contracts.types';

export function createProductQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.PRODUCT, {
    products: (query?: FindProductsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.products.find(query);
        },
      };
    },
    product: (productId: string) => {
      return {
        queryKey: [productId],
        queryFn: () => {
          return client.products.get(productId);
        },
      };
    },
  });
}
