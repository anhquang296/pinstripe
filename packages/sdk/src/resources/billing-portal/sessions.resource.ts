import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  BillingPortalSessionResponse,
  CreateBillingPortalSessionPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const BILLING_PORTAL_SESSIONS_PATH = '/v1/billing_portal/sessions';

export class BillingPortalSessionsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  get(sessionId: string, options?: RequestOptions): Promise<BillingPortalSessionResponse> {
    return this._transport.request({
      path: buildPath(BILLING_PORTAL_SESSIONS_PATH, sessionId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(
    payload: CreateBillingPortalSessionPayload,
    options?: RequestOptions,
  ): Promise<BillingPortalSessionResponse> {
    return this._transport.request({
      path: BILLING_PORTAL_SESSIONS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
