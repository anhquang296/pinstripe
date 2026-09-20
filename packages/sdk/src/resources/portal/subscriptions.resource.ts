import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  FindPortalSubscriptionsQuery,
  ListResponse,
  PortalSubscriptionResponse,
} from '@type/contracts.types';

const PORTAL_SUBSCRIPTIONS_PATH = '/v1/portal/subscriptions';

export class PortalSubscriptionsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
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
