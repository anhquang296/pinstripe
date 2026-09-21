import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
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
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
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

  get(productId: string, options?: RequestOptions): Promise<ProductResponse> {
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
