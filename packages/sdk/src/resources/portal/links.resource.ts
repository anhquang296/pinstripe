import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type { CreatePortalLinkPayload, PortalLinkResponse } from '@type/contracts.types';

const PORTAL_LINKS_PATH = '/v1/portal/links';

export class PortalLinksResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
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
