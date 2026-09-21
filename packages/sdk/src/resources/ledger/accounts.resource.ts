import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  FindLedgerAccountsQuery,
  LedgerAccountResponse,
  ListResponse,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const LEDGER_ACCOUNTS_PATH = '/v1/ledger/accounts';

export class LedgerAccountsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindLedgerAccountsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<LedgerAccountResponse>> {
    return this._transport.request({
      path: LEDGER_ACCOUNTS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(accountId: string, options?: RequestOptions): Promise<LedgerAccountResponse> {
    return this._transport.request({
      path: buildPath(LEDGER_ACCOUNTS_PATH, accountId),
      method: HttpMethodEnum.GET,
      options,
    });
  }
}
