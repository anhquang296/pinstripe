import type { PinstripeTransport } from '@client/pinstripe-transport';
import { AccountResource } from '@resources/admin/account.resource';
import { ApiKeysResource } from '@resources/admin/api-keys.resource';
import { LedgerAccountsResource } from '@resources/admin/ledger-accounts.resource';
import { LedgerTransactionsResource } from '@resources/admin/ledger-transactions.resource';
import { ReportingResource } from '@resources/admin/reporting.resource';
import { UsersResource } from '@resources/admin/users.resource';

export class AdminNamespace {
  readonly account: AccountResource;
  readonly apiKeys: ApiKeysResource;
  readonly ledgerAccounts: LedgerAccountsResource;
  readonly ledgerTransactions: LedgerTransactionsResource;
  readonly reporting: ReportingResource;
  readonly users: UsersResource;

  constructor(transport: PinstripeTransport) {
    this.account = new AccountResource(transport);
    this.apiKeys = new ApiKeysResource(transport);
    this.ledgerAccounts = new LedgerAccountsResource(transport);
    this.ledgerTransactions = new LedgerTransactionsResource(transport);
    this.reporting = new ReportingResource(transport);
    this.users = new UsersResource(transport);
  }
}
