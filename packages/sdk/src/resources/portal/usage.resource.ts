import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type { PortalUsageResponse } from '@type/contracts.types';

const PORTAL_USAGE_PATH = '/v1/portal/usage';

export class PortalUsageResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
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
