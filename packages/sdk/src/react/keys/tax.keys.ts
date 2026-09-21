import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindTaxIdsQuery, FindTaxRatesQuery } from '@type/contracts.types';

export function createTaxQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.TAX, {
    taxRates: (query?: FindTaxRatesQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.taxRates.find(query);
        },
      };
    },
    taxRate: (taxRateId: string) => {
      return {
        queryKey: [taxRateId],
        queryFn: () => {
          return client.taxRates.get(taxRateId);
        },
      };
    },
    taxIds: (query?: FindTaxIdsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.taxIds.find(query);
        },
      };
    },
    taxId: (taxIdId: string) => {
      return {
        queryKey: [taxIdId],
        queryFn: () => {
          return client.taxIds.get(taxIdId);
        },
      };
    },
  });
}
