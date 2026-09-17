import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindCustomersQuery } from '@type/contracts.types';

export function createCustomerQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.CUSTOMER, {
    customers: (query?: FindCustomersQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.customers.list(query);
        },
      };
    },
    customer: (customerId: string) => {
      return {
        queryKey: [customerId],
        queryFn: () => {
          return client.customers.retrieve(customerId);
        },
      };
    },
  });
}
