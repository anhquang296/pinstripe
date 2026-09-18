import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CouponResponse,
  CreateCouponPayload,
  DeletedCouponResponse,
  FindCouponsQuery,
  ListResponse,
  UpdateCouponPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const COUPONS_PATH = '/v1/coupons';

export class CouponsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(
    query: FindCouponsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<CouponResponse>> {
    return this._transport.request({
      path: COUPONS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(couponId: string, options?: RequestOptions): Promise<CouponResponse> {
    return this._transport.request({
      path: buildPath(COUPONS_PATH, couponId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(payload: CreateCouponPayload, options?: RequestOptions): Promise<CouponResponse> {
    return this._transport.request({
      path: COUPONS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    couponId: string,
    payload: UpdateCouponPayload,
    options?: RequestOptions,
  ): Promise<CouponResponse> {
    return this._transport.request({
      path: buildPath(COUPONS_PATH, couponId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  delete(couponId: string, options?: RequestOptions): Promise<DeletedCouponResponse> {
    return this._transport.request({
      path: buildPath(COUPONS_PATH, couponId),
      method: HttpMethodEnum.DELETE,
      options,
    });
  }
}
