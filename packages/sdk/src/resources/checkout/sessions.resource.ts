import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CheckoutSessionResponse,
  CreateCheckoutSessionPayload,
  FindCheckoutSessionsQuery,
  ListResponse,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const CHECKOUT_SESSIONS_PATH = '/v1/checkout/sessions';

export class CheckoutSessionsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(
    query: FindCheckoutSessionsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<CheckoutSessionResponse>> {
    return this._transport.request({
      path: CHECKOUT_SESSIONS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(checkoutSessionId: string, options?: RequestOptions): Promise<CheckoutSessionResponse> {
    return this._transport.request({
      path: buildPath(CHECKOUT_SESSIONS_PATH, checkoutSessionId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(
    payload: CreateCheckoutSessionPayload,
    options?: RequestOptions,
  ): Promise<CheckoutSessionResponse> {
    return this._transport.request({
      path: CHECKOUT_SESSIONS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
