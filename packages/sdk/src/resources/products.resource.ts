import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CreateProductPayload,
  FindProductsQuery,
  ListResponse,
  ProductResponse,
  UpdateProductPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const PRODUCTS_PATH = '/v1/products';

export class ProductsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  list(
    query: FindProductsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<ProductResponse>> {
    return this._transport.request({
      path: PRODUCTS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  retrieve(productId: string, options?: RequestOptions): Promise<ProductResponse> {
    return this._transport.request({
      path: buildPath(PRODUCTS_PATH, productId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(payload: CreateProductPayload, options?: RequestOptions): Promise<ProductResponse> {
    return this._transport.request({
      path: PRODUCTS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    productId: string,
    payload: UpdateProductPayload,
    options?: RequestOptions,
  ): Promise<ProductResponse> {
    return this._transport.request({
      path: buildPath(PRODUCTS_PATH, productId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
