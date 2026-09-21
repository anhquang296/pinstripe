import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  BillingPortalSessionResponse,
  CreateBillingPortalSessionPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const BILLING_PORTAL_SESSIONS_PATH = '/v1/billing_portal/sessions';

export class BillingPortalSessionsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
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
