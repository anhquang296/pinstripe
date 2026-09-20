import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type { PortalIdentityResponse } from '@type/contracts.types';

const PORTAL_ACCOUNT_PATH = '/v1/portal/me';

export class PortalAccountResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  get(options?: RequestOptions): Promise<PortalIdentityResponse> {
    return this._transport.request({
      path: PORTAL_ACCOUNT_PATH,
      method: HttpMethodEnum.GET,
      options,
    });
  }
}
