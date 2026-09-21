import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindProductsQuery } from '@type/contracts.types';

export function createProductQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.PRODUCT, {
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
