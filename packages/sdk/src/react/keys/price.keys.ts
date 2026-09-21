import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindPricesQuery } from '@type/contracts.types';

export function createPriceQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.PRICE, {
    prices: (query?: FindPricesQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.prices.find(query);
        },
      };
    },
    price: (priceId: string) => {
      return {
        queryKey: [priceId],
        queryFn: () => {
          return client.prices.get(priceId);
        },
      };
    },
  });
}
