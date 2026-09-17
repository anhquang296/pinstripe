import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindPricesQuery } from '@type/contracts.types';

export function createPriceQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.PRICE, {
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
