import { createQueryKeys } from '@lukemorales/query-key-factory';
import type { GetLedgerAccountsQuery, GetLedgerTransactionsQuery } from '@pinstripe/core/contracts';
import {
  getLedgerAccounts,
  getLedgerTransaction,
  getLedgerTransactions,
} from '@api/ledger/ledger.api';
import { ReactQuerySubjectEnum } from '@react-query-keys/react-query-subject';

export const ledgerQueries = createQueryKeys(ReactQuerySubjectEnum.LEDGER, {
  accounts: (query?: GetLedgerAccountsQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getLedgerAccounts(query);
      },
    };
  },
  transactions: (query?: GetLedgerTransactionsQuery) => {
    return {
      queryKey: [query],
      queryFn: () => {
        return getLedgerTransactions(query);
      },
    };
  },
  transaction: (transactionId: string) => {
    return {
      queryKey: [transactionId],
      queryFn: () => {
        return getLedgerTransaction(transactionId);
      },
    };
  },
});
