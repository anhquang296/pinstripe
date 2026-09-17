import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  FindLedgerTransactionsQuery,
  LedgerTransactionResponse,
  ListResponse,
  PostLedgerTransactionPayload,
  ReverseLedgerTransactionPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const LEDGER_TRANSACTIONS_PATH = '/api/v1/admin/ledger/transactions';

export class LedgerTransactionsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  list(
    query: FindLedgerTransactionsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<LedgerTransactionResponse>> {
    return this._transport.request({
      path: LEDGER_TRANSACTIONS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  retrieve(transactionId: string, options?: RequestOptions): Promise<LedgerTransactionResponse> {
    return this._transport.request({
      path: buildPath(LEDGER_TRANSACTIONS_PATH, transactionId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(
    payload: PostLedgerTransactionPayload,
    options?: RequestOptions,
  ): Promise<LedgerTransactionResponse> {
    return this._transport.request({
      path: LEDGER_TRANSACTIONS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  reverse(
    transactionId: string,
    payload: ReverseLedgerTransactionPayload,
    options?: RequestOptions,
  ): Promise<LedgerTransactionResponse> {
    return this._transport.request({
      path: buildPath(LEDGER_TRANSACTIONS_PATH, transactionId, 'reverse'),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
