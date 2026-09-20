import type { PinstripeTransport } from '@client/pinstripe-transport';
import { LedgerAccountsResource } from '@resources/ledger/accounts.resource';
import { LedgerTransactionsResource } from '@resources/ledger/transactions.resource';

export class LedgerNamespace {
  readonly accounts: LedgerAccountsResource;
  readonly transactions: LedgerTransactionsResource;

  constructor(transport: PinstripeTransport) {
    this.accounts = new LedgerAccountsResource(transport);
    this.transactions = new LedgerTransactionsResource(transport);
  }
}
