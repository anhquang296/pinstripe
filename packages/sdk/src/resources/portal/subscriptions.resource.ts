import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  FindPortalSubscriptionsQuery,
  ListResponse,
  PortalSubscriptionResponse,
} from '@type/contracts.types';

const PORTAL_SUBSCRIPTIONS_PATH = '/v1/portal/subscriptions';

export class PortalSubscriptionsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindPortalSubscriptionsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<PortalSubscriptionResponse>> {
    return this._transport.request({
      path: PORTAL_SUBSCRIPTIONS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }
}
