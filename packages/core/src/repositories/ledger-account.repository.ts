import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { LedgerAccountCode } from '@contracts/ledger.types';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { LedgerAccountEntity, NewLedgerAccountEntity } from '@database/schemas';
import { ledgerAccountBalances, ledgerAccounts } from '@database/schemas';
import type { Currency } from '@utils/currency';

export interface FindLedgerAccountsFilters {
  idIn?: readonly string[];
  codeEq?: LedgerAccountCode;
  currencyEq?: Currency;
  customerIdEq?: string;
  customerIdIsNull?: boolean;
}

export interface LedgerAccountWithBalance extends LedgerAccountEntity {
  debits: number;
  credits: number;
  balance: number;
}

export class LedgerAccountRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findLedgerAccount(id: string): Promise<LedgerAccountWithBalance | null> {
    const [account] = await this._db.master
      .select()
      .from(ledgerAccounts)
      .leftJoin(ledgerAccountBalances, eq(ledgerAccountBalances.accountId, ledgerAccounts.id))
      .where(eq(ledgerAccounts.id, id))
      .limit(1);

    return account ? LedgerAccountRepository.mergeBalance(account) : null;
  }

  async findLedgerAccounts(
    filters: FindLedgerAccountsFilters,
    limit: number,
  ): Promise<LedgerAccountWithBalance[]> {
    const where = and(
      filters.idIn ? inArray(ledgerAccounts.id, [...filters.idIn]) : undefined,
      filters.codeEq ? eq(ledgerAccounts.code, filters.codeEq) : undefined,
      filters.currencyEq ? eq(ledgerAccounts.currency, filters.currencyEq) : undefined,
      filters.customerIdEq ? eq(ledgerAccounts.customerId, filters.customerIdEq) : undefined,
      filters.customerIdIsNull ? isNull(ledgerAccounts.customerId) : undefined,
    );

    const rows = await this._db.master
      .select()
      .from(ledgerAccounts)
      .leftJoin(ledgerAccountBalances, eq(ledgerAccountBalances.accountId, ledgerAccounts.id))
      .where(where)
      .orderBy(desc(ledgerAccounts.createdAt), desc(ledgerAccounts.id))
      .limit(limit);

    return rows.map(LedgerAccountRepository.mergeBalance);
  }

  async createLedgerAccount(
    payload: NewLedgerAccountEntity,
    executor?: DatabaseTransaction,
  ): Promise<LedgerAccountEntity | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [account] = await db.insert(ledgerAccounts).values(payload).returning();

    return account ?? null;
  }

  async aggregateImbalancedTransactions(limit: number): Promise<{ transactionId: string }[]> {
    const rows = await this._db.master.execute<{ transactionId: string }>(sql`
      select transaction_id as "transactionId"
      from ledger_postings
      group by transaction_id
      having sum(case when direction = 'debit' then amount else -amount end) <> 0
      limit ${limit}
    `);

    return [...rows];
  }

  private static mergeBalance(row: {
    ledger_accounts: LedgerAccountEntity;
    ledger_account_balances: { debits: number; credits: number; balance: number } | null;
  }): LedgerAccountWithBalance {
    const balances = row.ledger_account_balances;

    return {
      ...row.ledger_accounts,
      debits: balances?.debits ?? 0,
      credits: balances?.credits ?? 0,
      balance: balances?.balance ?? 0,
    };
  }
}
