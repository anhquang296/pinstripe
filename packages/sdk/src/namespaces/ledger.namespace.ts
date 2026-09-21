import type { VxrErpTransport } from '@client/vxr-erp-transport';
import { LedgerAccountsResource } from '@resources/ledger/accounts.resource';
import { LedgerTransactionsResource } from '@resources/ledger/transactions.resource';

export class LedgerNamespace {
  readonly accounts: LedgerAccountsResource;
  readonly transactions: LedgerTransactionsResource;

  constructor(transport: VxrErpTransport) {
    this.accounts = new LedgerAccountsResource(transport);
    this.transactions = new LedgerTransactionsResource(transport);
  }
}
