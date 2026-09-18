import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CreateSubscriptionItemPayload,
  DeletedSubscriptionItemResponse,
  DeleteSubscriptionItemPayload,
  FindSubscriptionItemsQuery,
  ListResponse,
  SubscriptionItemResponse,
  UpdateSubscriptionItemPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const SUBSCRIPTION_ITEMS_PATH = '/v1/subscription_items';

export class SubscriptionItemsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(
    query: FindSubscriptionItemsQuery,
    options?: RequestOptions,
  ): Promise<ListResponse<SubscriptionItemResponse>> {
    return this._transport.request({
      path: SUBSCRIPTION_ITEMS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(subscriptionItemId: string, options?: RequestOptions): Promise<SubscriptionItemResponse> {
    return this._transport.request({
      path: buildPath(SUBSCRIPTION_ITEMS_PATH, subscriptionItemId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(
    payload: CreateSubscriptionItemPayload,
    options?: RequestOptions,
  ): Promise<SubscriptionItemResponse> {
    return this._transport.request({
      path: SUBSCRIPTION_ITEMS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    subscriptionItemId: string,
    payload: UpdateSubscriptionItemPayload,
    options?: RequestOptions,
  ): Promise<SubscriptionItemResponse> {
    return this._transport.request({
      path: buildPath(SUBSCRIPTION_ITEMS_PATH, subscriptionItemId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  delete(
    subscriptionItemId: string,
    payload: DeleteSubscriptionItemPayload = {},
    options?: RequestOptions,
  ): Promise<DeletedSubscriptionItemResponse> {
    return this._transport.request({
      path: buildPath(SUBSCRIPTION_ITEMS_PATH, subscriptionItemId),
      method: HttpMethodEnum.DELETE,
      payload,
      options,
    });
  }
}
