import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type { CreatePortalRequestPayload, PortalRequestResponse } from '@type/contracts.types';

const PORTAL_REQUESTS_PATH = '/v1/portal/requests';

export class PortalRequestsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
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
