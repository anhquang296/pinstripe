import { createQueryKeys } from '@lukemorales/query-key-factory';
import type { GetCustomersQuery } from '@pinstripe/core/contracts';
import { getCustomer, getCustomers } from '@api/customers/customers.api';
import { ReactQuerySubjectEnum } from '@react-query-keys/react-query-subject';

export const customerQueries = createQueryKeys(ReactQuerySubjectEnum.CUSTOMER, {
  customers: (query?: GetCustomersQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getCustomers(query);
      },
    };
  },
  customer: (customerId: string) => {
    return {
      queryKey: [customerId],
      queryFn: () => {
        return getCustomer(customerId);
      },
    };
  },
});
