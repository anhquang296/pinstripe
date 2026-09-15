import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { GetLedgerAccountsQuery, GetLedgerTransactionsQuery } from '@pinstripe/core/contracts';
import type { QueryProps } from '@lib/react-query.types';
import { queries } from '@react-query-keys/index';

export function useLedgerAccountsQuery(
  query?: GetLedgerAccountsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.ledger.accounts(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useLedgerTransactionsQuery(
  query?: GetLedgerTransactionsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  return useQuery({
    ...queries.ledger.transactions(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}
