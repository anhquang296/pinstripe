import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type { PortalIdentityResponse } from '@type/contracts.types';

const PORTAL_ACCOUNT_PATH = '/v1/portal/me';

export class PortalAccountResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
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
