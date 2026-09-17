import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { GetPricesQuery } from '@type/contracts.types';

export function createPriceQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.PRICE, {
    prices: (query?: GetPricesQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.prices.list(query);
        },
      };
    },
    price: (priceId: string) => {
      return {
        queryKey: [priceId],
        queryFn: () => {
          return client.prices.retrieve(priceId);
        },
      };
    },
  });
}
