import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindTaxIdsQuery, FindTaxRatesQuery } from '@type/contracts.types';

export function createTaxQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.TAX, {
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
