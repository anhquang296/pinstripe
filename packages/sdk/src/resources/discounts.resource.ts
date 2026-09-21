import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  CreateDiscountPayload,
  DeletedDiscountResponse,
  DiscountResponse,
  FindDiscountsQuery,
  ListResponse,
  UpdateDiscountPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const DISCOUNTS_PATH = '/v1/discounts';

export class DiscountsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindDiscountsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<DiscountResponse>> {
    return this._transport.request({
      path: DISCOUNTS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(discountId: string, options?: RequestOptions): Promise<DiscountResponse> {
    return this._transport.request({
      path: buildPath(DISCOUNTS_PATH, discountId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(payload: CreateDiscountPayload, options?: RequestOptions): Promise<DiscountResponse> {
    return this._transport.request({
      path: DISCOUNTS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    discountId: string,
    payload: UpdateDiscountPayload,
    options?: RequestOptions,
  ): Promise<DiscountResponse> {
    return this._transport.request({
      path: buildPath(DISCOUNTS_PATH, discountId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  delete(discountId: string, options?: RequestOptions): Promise<DeletedDiscountResponse> {
    return this._transport.request({
      path: buildPath(DISCOUNTS_PATH, discountId),
      method: HttpMethodEnum.DELETE,
      options,
    });
  }
}
