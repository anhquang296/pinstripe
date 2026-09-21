import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindPaymentIntentsQuery, FindRefundsQuery } from '@type/contracts.types';

export function createPaymentQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.PAYMENT, {
    paymentIntents: (query?: FindPaymentIntentsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.paymentIntents.find(query);
        },
      };
    },
    paymentIntent: (paymentIntentId: string) => {
      return {
        queryKey: [paymentIntentId],
        queryFn: () => {
          return client.paymentIntents.get(paymentIntentId);
        },
      };
    },
    refunds: (query?: FindRefundsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.refunds.find(query);
        },
      };
    },
    refund: (refundId: string) => {
      return {
        queryKey: [refundId],
        queryFn: () => {
          return client.refunds.get(refundId);
        },
      };
    },
  });
}
