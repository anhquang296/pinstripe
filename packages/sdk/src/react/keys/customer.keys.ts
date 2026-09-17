import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type {
  FindCustomerBalanceTransactionsQuery,
  FindCustomersQuery,
} from '@type/contracts.types';

export function createCustomerQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.CUSTOMER, {
    customers: (query?: FindCustomersQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.customers.find(query);
        },
      };
    },
    customer: (customerId: string) => {
      return {
        queryKey: [customerId],
        queryFn: () => {
          return client.customers.get(customerId);
        },
        contextQueries: {
          balanceTransactions: (query?: FindCustomerBalanceTransactionsQuery) => {
            return {
              queryKey: [query],
              queryFn: () => {
                return client.customers.findBalanceTransactions(customerId, query);
              },
            };
          },
        },
      };
    },
  });
}
