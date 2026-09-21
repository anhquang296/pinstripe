import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  FindLedgerTransactionsQuery,
  LedgerTransactionResponse,
  ListResponse,
  PostLedgerTransactionPayload,
  ReverseLedgerTransactionPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const LEDGER_TRANSACTIONS_PATH = '/v1/ledger/transactions';

export class LedgerTransactionsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
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

  get(transactionId: string, options?: RequestOptions): Promise<LedgerTransactionResponse> {
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
