import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  PortalSessionResponse,
  RedeemPortalLinkPayload,
  SwitchPortalCustomerPayload,
} from '@type/contracts.types';

const PORTAL_SESSIONS_PATH = '/portal/sessions';

export class PortalSessionsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
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
