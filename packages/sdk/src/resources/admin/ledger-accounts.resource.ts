import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  FindLedgerAccountsQuery,
  LedgerAccountResponse,
  ListResponse,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const LEDGER_ACCOUNTS_PATH = '/api/v1/admin/ledger/accounts';

export class LedgerAccountsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
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
