import type { VxrErpClient } from '@client/vxr-erp.client';
import { createQueryKeys } from '@lukemorales/query-key-factory';
import { VxrErpQuerySubjectEnum } from '@react/vxr-erp-query-subject';
import type { FindLedgerAccountsQuery, FindLedgerTransactionsQuery } from '@type/contracts.types';

export function createLedgerQueries(client: VxrErpClient) {
  return createQueryKeys(VxrErpQuerySubjectEnum.LEDGER, {
    accounts: (query?: FindLedgerAccountsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.ledger.accounts.find(query);
        },
      };
    },
    account: (ledgerAccountId: string) => {
      return {
        queryKey: [ledgerAccountId],
        queryFn: () => {
          return client.ledger.accounts.get(ledgerAccountId);
        },
      };
    },
    transactions: (query?: FindLedgerTransactionsQuery) => {
      return {
        queryKey: [query],
        queryFn: () => {
          return client.ledger.transactions.find(query);
        },
      };
    },
    transaction: (transactionId: string) => {
      return {
        queryKey: [transactionId],
        queryFn: () => {
          return client.ledger.transactions.get(transactionId);
        },
      };
    },
  });
}
