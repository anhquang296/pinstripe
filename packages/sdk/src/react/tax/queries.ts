import type { QueryProps } from '@react/react-query.types';
import { useVxrErpQueries } from '@react/vxr-erp.provider';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindTaxIdsQuery, FindTaxRatesQuery } from '@type/contracts.types';

export function useTaxRatesQuery(
  query?: FindTaxRatesQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = useVxrErpQueries();

  return useQuery({
    ...queries.tax.taxRates(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useTaxRateQuery(taxRateId: string, { enabled = true }: QueryProps = {}) {
  const queries = useVxrErpQueries();

  return useQuery({ ...queries.tax.taxRate(taxRateId), enabled: enabled && Boolean(taxRateId) });
}

export function useTaxIdsQuery(
  query?: FindTaxIdsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = useVxrErpQueries();

  return useQuery({
    ...queries.tax.taxIds(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useTaxIdQuery(taxIdId: string, { enabled = true }: QueryProps = {}) {
  const queries = useVxrErpQueries();

  return useQuery({ ...queries.tax.taxId(taxIdId), enabled: enabled && Boolean(taxIdId) });
}
