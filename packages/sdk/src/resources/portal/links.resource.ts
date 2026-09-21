import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type { CreatePortalLinkPayload, PortalLinkResponse } from '@type/contracts.types';

const PORTAL_LINKS_PATH = '/v1/portal/links';

export class PortalLinksResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  create(payload: CreatePortalLinkPayload, options?: RequestOptions): Promise<PortalLinkResponse> {
    return this._transport.request({
      path: PORTAL_LINKS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
