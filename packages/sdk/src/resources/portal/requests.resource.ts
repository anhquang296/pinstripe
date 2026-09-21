import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type { CreatePortalRequestPayload, PortalRequestResponse } from '@type/contracts.types';

const PORTAL_REQUESTS_PATH = '/v1/portal/requests';

export class PortalRequestsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  create(
    payload: CreatePortalRequestPayload,
    options?: RequestOptions,
  ): Promise<PortalRequestResponse> {
    return this._transport.request({
      path: PORTAL_REQUESTS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
