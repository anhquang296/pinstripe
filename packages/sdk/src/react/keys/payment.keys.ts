import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { GetPaymentIntentsQuery, GetRefundsQuery } from '@type/contracts.types';

export function createPaymentQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.PAYMENT, {
    paymentIntents: (query?: GetPaymentIntentsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.paymentIntents.list(query);
        },
      };
    },
    refunds: (query?: GetRefundsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.refunds.list(query);
        },
      };
    },
  });
}
