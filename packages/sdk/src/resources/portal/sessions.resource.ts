import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  PortalSessionResponse,
  RedeemPortalLinkPayload,
  SwitchPortalCustomerPayload,
} from '@type/contracts.types';

const PORTAL_SESSIONS_PATH = '/v1/portal/sessions';

export class PortalSessionsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  create(
    payload: RedeemPortalLinkPayload,
    options?: RequestOptions,
  ): Promise<PortalSessionResponse> {
    return this._transport.request({
      path: PORTAL_SESSIONS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    payload: SwitchPortalCustomerPayload,
    options?: RequestOptions,
  ): Promise<PortalSessionResponse> {
    return this._transport.request({
      path: `${PORTAL_SESSIONS_PATH}/current`,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  delete(options?: RequestOptions): Promise<PortalSessionResponse> {
    return this._transport.request({
      path: PORTAL_SESSIONS_PATH,
      method: HttpMethodEnum.DELETE,
      options,
    });
  }
}
