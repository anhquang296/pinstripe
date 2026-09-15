import { getProduct, getProducts } from '@api/products';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import type { GetProductsQuery } from '@pinstripe/core/contracts';
import { ReactQuerySubjectEnum } from '@react-query-keys/react-query-subject';

export const productQueries = createQueryKeys(ReactQuerySubjectEnum.PRODUCT, {
  products: (query?: GetProductsQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getProducts(query);
      },
    };
  },
  product: (productId: string) => {
    return {
      queryKey: [productId],
      queryFn: () => {
        return getProduct(productId);
      },
    };
  },
});
