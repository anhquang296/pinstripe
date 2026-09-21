import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type {
  FindCustomerBalanceTransactionsQuery,
  FindCustomersQuery,
} from '@type/contracts.types';

export function createCustomerQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.CUSTOMER, {
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
