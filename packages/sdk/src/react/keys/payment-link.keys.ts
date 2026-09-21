import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindPaymentLinksQuery } from '@type/contracts.types';

export function createPaymentLinkQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.PAYMENT_LINK, {
    paymentLinks: (query?: FindPaymentLinksQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.paymentLinks.find(query);
        },
      };
    },
    paymentLink: (paymentLinkId: string) => {
      return {
        queryKey: [paymentLinkId],
        queryFn: () => {
          return client.paymentLinks.get(paymentLinkId);
        },
      };
    },
  });
}
