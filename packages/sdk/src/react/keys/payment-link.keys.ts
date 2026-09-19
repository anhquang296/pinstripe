import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindPaymentLinksQuery } from '@type/contracts.types';

export function createPaymentLinkQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.PAYMENT_LINK, {
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
