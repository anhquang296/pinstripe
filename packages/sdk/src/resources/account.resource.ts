import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type { AccountResponse } from '@type/contracts.types';

const ACCOUNT_PATH = '/v1/account';

export class AccountResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  get(options?: RequestOptions): Promise<AccountResponse> {
    return this._transport.request({
      path: ACCOUNT_PATH,
      method: HttpMethodEnum.GET,
      options,
    });
  }
}
