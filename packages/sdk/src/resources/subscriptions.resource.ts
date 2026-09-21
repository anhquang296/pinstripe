import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  CancelSubscriptionPayload,
  CreateSubscriptionPayload,
  FindSubscriptionsQuery,
  ListResponse,
  SubscriptionResponse,
  UpdateSubscriptionPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const SUBSCRIPTIONS_PATH = '/v1/subscriptions';

export class SubscriptionsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindSubscriptionsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<SubscriptionResponse>> {
    return this._transport.request({
      path: SUBSCRIPTIONS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(subscriptionId: string, options?: RequestOptions): Promise<SubscriptionResponse> {
    return this._transport.request({
      path: buildPath(SUBSCRIPTIONS_PATH, subscriptionId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(
    payload: CreateSubscriptionPayload,
    options?: RequestOptions,
  ): Promise<SubscriptionResponse> {
    return this._transport.request({
      path: SUBSCRIPTIONS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    subscriptionId: string,
    payload: UpdateSubscriptionPayload,
    options?: RequestOptions,
  ): Promise<SubscriptionResponse> {
    return this._transport.request({
      path: buildPath(SUBSCRIPTIONS_PATH, subscriptionId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  cancel(
    subscriptionId: string,
    payload: CancelSubscriptionPayload = {},
    options?: RequestOptions,
  ): Promise<SubscriptionResponse> {
    return this._transport.request({
      path: buildPath(SUBSCRIPTIONS_PATH, subscriptionId),
      method: HttpMethodEnum.DELETE,
      payload,
      options,
    });
  }
}
