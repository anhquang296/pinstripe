import type { PinstripeTransport } from '@client/pinstripe-transport';
import { LedgerAccountsResource } from '@resources/admin/ledger-accounts.resource';
import { LedgerTransactionsResource } from '@resources/admin/ledger-transactions.resource';
import { ReportingResource } from '@resources/admin/reporting.resource';

export class AdminNamespace {
  readonly ledgerAccounts: LedgerAccountsResource;
  readonly ledgerTransactions: LedgerTransactionsResource;
  readonly reporting: ReportingResource;

  constructor(transport: PinstripeTransport) {
    this.ledgerAccounts = new LedgerAccountsResource(transport);
    this.ledgerTransactions = new LedgerTransactionsResource(transport);
    this.reporting = new ReportingResource(transport);
  }
}
