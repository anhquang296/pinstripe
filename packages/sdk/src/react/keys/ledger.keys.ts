import type { PinstripeClient } from '@client/pinstripe.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { PinstripeQuerySubjectEnum } from '@react/pinstripe-query-subject';
import type { FindLedgerAccountsQuery, FindLedgerTransactionsQuery } from '@type/contracts.types';

export function createLedgerQueries(client: PinstripeClient) {
  return createQueryKeys(PinstripeQuerySubjectEnum.LEDGER, {
    accounts: (query?: FindLedgerAccountsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.admin.ledgerAccounts.list(query);
        },
      };
    },
    transactions: (query?: FindLedgerTransactionsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.admin.ledgerTransactions.list(query);
        },
      };
    },
    transaction: (transactionId: string) => {
      return {
        queryKey: [transactionId],
        queryFn: () => {
          return client.admin.ledgerTransactions.retrieve(transactionId);
        },
      };
    },
  });
}
