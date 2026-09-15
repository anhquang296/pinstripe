import { getPaymentIntents, getRefunds } from '@api/payments';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import type { GetPaymentIntentsQuery, GetRefundsQuery } from '@pinstripe/core/contracts';
import { ReactQuerySubjectEnum } from '@react-query-keys/react-query-subject';

export const paymentQueries = createQueryKeys(ReactQuerySubjectEnum.PAYMENT, {
  paymentIntents: (query?: GetPaymentIntentsQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getPaymentIntents(query);
      },
    };
  },
  refunds: (query?: GetRefundsQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getRefunds(query);
      },
    };
  },
});
