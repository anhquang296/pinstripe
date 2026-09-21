import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type { AccountResponse } from '@type/contracts.types';

const ACCOUNT_PATH = '/v1/account';

export class AccountResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
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
