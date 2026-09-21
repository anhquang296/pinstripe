import type { LedgerAccountCode } from '@contracts/ledger.types';
import type { LedgerAccount, NewLedgerAccount } from '@database/schemas';
import { ledgerAccountBalances, ledgerAccounts } from '@database/schemas';
import type { Currency } from '@utils/currency';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { Database, DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import { NotFoundError } from '@vxrerp/platform/errors';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import _ from 'lodash';

export interface LedgerAccountFilters {
  ids?: readonly string[];
  code?: LedgerAccountCode;
  currency?: Currency;
  customerId?: string;
  customerIdIsNull?: boolean;
}

export interface LedgerAccountWithBalance extends LedgerAccount {
  debits: number;
  credits: number;
  balance: number;
}

export class LedgerAccountRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getLedgerAccount(id: string): Promise<LedgerAccountWithBalance> {
    const ledgerAccount = await this.findLedgerAccount(id);

    if (ledgerAccount) {
      return ledgerAccount;
    }

    throw new NotFoundError(`No such ledger account: ${id}`);
  }

  async findLedgerAccount(id: string): Promise<LedgerAccountWithBalance | null> {
    const [account] = await this._db.master
      .select()
      .from(ledgerAccounts)
      .leftJoin(ledgerAccountBalances, eq(ledgerAccountBalances.accountId, ledgerAccounts.id))
      .where(eq(ledgerAccounts.id, id))
      .limit(1);

    if (account) {
      return LedgerAccountRepository.mergeBalance(account);
    }

    return null;
  }

  async findLedgerAccounts(
    filters: LedgerAccountFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<LedgerAccountWithBalance[]> {
    const where = and(
      filters.ids ? inArray(ledgerAccounts.id, [...filters.ids]) : undefined,
      filters.code ? eq(ledgerAccounts.code, filters.code) : undefined,
      filters.currency ? eq(ledgerAccounts.currency, filters.currency) : undefined,
      filters.customerId ? eq(ledgerAccounts.customerId, filters.customerId) : undefined,
      filters.customerIdIsNull ? isNull(ledgerAccounts.customerId) : undefined,
    );

    const accountRows = await this._db.master
      .select()
      .from(ledgerAccounts)
      .leftJoin(ledgerAccountBalances, eq(ledgerAccountBalances.accountId, ledgerAccounts.id))
      .where(where)
      .orderBy(desc(ledgerAccounts.createdAt), desc(ledgerAccounts.id))
      .limit(limit);

    return _.map(accountRows, LedgerAccountRepository.mergeBalance);
  }

  async createLedgerAccount(
    payload: NewLedgerAccount,
    executor?: DatabaseTransaction,
  ): Promise<LedgerAccount | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    const [account] = await db.insert(ledgerAccounts).values(payload).returning();

    return account ?? null;
  }

  private static mergeBalance(row: {
    ledger_accounts: LedgerAccount;
    ledger_account_balances: { debits: number; credits: number; balance: number } | null;
  }): LedgerAccountWithBalance {
    const balances = row.ledger_account_balances;

    return {
      ...row.ledger_accounts,
      debits: _.get(balances, 'debits', 0),
      credits: _.get(balances, 'credits', 0),
      balance: _.get(balances, 'balance', 0),
    };
  }
}
