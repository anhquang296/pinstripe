import type {
  GetLedgerAccountsQuery,
  GetLedgerTransactionsQuery,
  LedgerAccount,
  LedgerTransaction,
  ListResponse,
  ReverseLedgerTransactionPayload,
} from '@pinstripe/core/contracts';
import { Endpoint, Method, Params, Payload, Request } from '@api/request';

const LEDGER_PATH = '/api/v1/admin/ledger';

export function getLedgerAccounts(
  query: GetLedgerAccountsQuery = {},
): Promise<ListResponse<LedgerAccount>> {
  return Request<ListResponse<LedgerAccount>>(
    Endpoint(`${LEDGER_PATH}/accounts`),
    Method('GET'),
    Params(query as Record<string, unknown>),
  );
}

export function getLedgerTransactions(
  query: GetLedgerTransactionsQuery = {},
): Promise<ListResponse<LedgerTransaction>> {
  return Request<ListResponse<LedgerTransaction>>(
    Endpoint(`${LEDGER_PATH}/transactions`),
    Method('GET'),
    Params(query as Record<string, unknown>),
  );
}

export function getLedgerTransaction(transactionId: string): Promise<LedgerTransaction> {
  return Request<LedgerTransaction>(
    Endpoint(`${LEDGER_PATH}/transactions/${encodeURIComponent(transactionId)}`),
    Method('GET'),
  );
}

export function reverseLedgerTransaction(
  transactionId: string,
  payload: ReverseLedgerTransactionPayload,
): Promise<LedgerTransaction> {
  return Request<LedgerTransaction>(
    Endpoint(`${LEDGER_PATH}/transactions/${encodeURIComponent(transactionId)}/reverse`),
    Method('POST'),
    Payload(payload as Record<string, unknown>),
  );
}
