import { createQueryKeys } from '@lukemorales/query-key-factory';
import type { GetPricesQuery } from '@pinstripe/core/contracts';
import { getPrice, getPrices } from '@api/prices/prices.api';
import { ReactQuerySubjectEnum } from '@react-query-keys/react-query-subject';

export const priceQueries = createQueryKeys(ReactQuerySubjectEnum.PRICE, {
  prices: (query?: GetPricesQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getPrices(query);
      },
    };
  },
  price: (priceId: string) => {
    return {
      queryKey: [priceId],
      queryFn: () => {
        return getPrice(priceId);
      },
    };
  },
});
