import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindPaymentIntentsQuery, FindRefundsQuery } from '@type/contracts.types';

export function createPaymentQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.PAYMENT, {
    paymentIntents: (query?: FindPaymentIntentsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.paymentIntents.list(query);
        },
      };
    },
    refunds: (query?: FindRefundsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.refunds.list(query);
        },
      };
    },
  });
}
