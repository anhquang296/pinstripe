import { Endpoint, Method, Params, Payload, Request } from '@api/client';

import type {
  GetLedgerAccountsQuery,
  GetLedgerTransactionsQuery,
  LedgerAccountResponse,
  LedgerTransactionResponse,
  ListResponse,
  ReverseLedgerTransactionPayload,
} from './type';

const LEDGER_PATH = '/api/v1/admin/ledger';

export function getLedgerAccounts(
  query: GetLedgerAccountsQuery = {},
): Promise<ListResponse<LedgerAccountResponse>> {
  return Request<ListResponse<LedgerAccountResponse>>(
    Endpoint(`${LEDGER_PATH}/accounts`),
    Method('GET'),
    Params(query),
  );
}

export function getLedgerTransactions(
  query: GetLedgerTransactionsQuery = {},
): Promise<ListResponse<LedgerTransactionResponse>> {
  return Request<ListResponse<LedgerTransactionResponse>>(
    Endpoint(`${LEDGER_PATH}/transactions`),
    Method('GET'),
    Params(query),
  );
}

export function getLedgerTransaction(transactionId: string): Promise<LedgerTransactionResponse> {
  return Request<LedgerTransactionResponse>(
    Endpoint(`${LEDGER_PATH}/transactions/${encodeURIComponent(transactionId)}`),
    Method('GET'),
  );
}

export function reverseLedgerTransaction(
  transactionId: string,
  payload: ReverseLedgerTransactionPayload,
): Promise<LedgerTransactionResponse> {
  return Request<LedgerTransactionResponse>(
    Endpoint(`${LEDGER_PATH}/transactions/${encodeURIComponent(transactionId)}/reverse`),
    Method('POST'),
    Payload(payload),
  );
}
