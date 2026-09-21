import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  CreatePricePayload,
  FindPricesQuery,
  ListResponse,
  PriceResponse,
  UpdatePricePayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const PRICES_PATH = '/v1/prices';

export class PricesResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindPricesQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<PriceResponse>> {
    return this._transport.request({
      path: PRICES_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(priceId: string, options?: RequestOptions): Promise<PriceResponse> {
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
