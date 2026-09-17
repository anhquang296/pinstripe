import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CreatePricePayload,
  GetPricesQuery,
  ListResponse,
  PriceResponse,
  UpdatePricePayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const PRICES_PATH = '/v1/prices';

export class PricesResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  list(query: GetPricesQuery = {}, options?: RequestOptions): Promise<ListResponse<PriceResponse>> {
    return this._transport.request({
      path: PRICES_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  retrieve(priceId: string, options?: RequestOptions): Promise<PriceResponse> {
    return this._transport.request({
      path: buildPath(PRICES_PATH, priceId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(payload: CreatePricePayload, options?: RequestOptions): Promise<PriceResponse> {
    return this._transport.request({
      path: PRICES_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    priceId: string,
    payload: UpdatePricePayload,
    options?: RequestOptions,
  ): Promise<PriceResponse> {
    return this._transport.request({
      path: buildPath(PRICES_PATH, priceId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
