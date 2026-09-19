import { usePinstripeQueries } from '@react/pinstripe.provider';
import type { QueryProps } from '@react/react-query.types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FindLedgerAccountsQuery, FindLedgerTransactionsQuery } from '@type/contracts.types';

export function useLedgerAccountsQuery(
  query?: FindLedgerAccountsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.ledger.accounts(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useLedgerAccountQuery(
  ledgerAccountId: string,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.ledger.account(ledgerAccountId),
    enabled: enabled && Boolean(ledgerAccountId),
  });
}

export function useLedgerTransactionsQuery(
  query?: FindLedgerTransactionsQuery,
  { enabled = true, hasPlaceholder = false }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({
    ...queries.ledger.transactions(query),
    enabled,
    placeholderData: hasPlaceholder ? keepPreviousData : undefined,
  });
}

export function useLedgerTransactionQuery(
  transactionId: string,
  { enabled = true }: QueryProps = {},
) {
  const queries = usePinstripeQueries();

  return useQuery({ ...queries.ledger.transaction(transactionId), enabled });
}
