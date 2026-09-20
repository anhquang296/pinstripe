import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type { PortalUsageResponse } from '@type/contracts.types';

const PORTAL_USAGE_PATH = '/v1/portal/usage';

export class PortalUsageResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(options?: RequestOptions): Promise<PortalUsageResponse> {
    return this._transport.request({
      path: PORTAL_USAGE_PATH,
      method: HttpMethodEnum.GET,
      options,
    });
  }
}
