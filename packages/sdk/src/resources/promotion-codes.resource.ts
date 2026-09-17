import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CreatePromotionCodePayload,
  FindPromotionCodesQuery,
  ListResponse,
  PromotionCodeResponse,
  UpdatePromotionCodePayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const PROMOTION_CODES_PATH = '/v1/promotion_codes';

export class PromotionCodesResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  find(
    query: FindPromotionCodesQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<PromotionCodeResponse>> {
    return this._transport.request({
      path: PROMOTION_CODES_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(promotionCodeId: string, options?: RequestOptions): Promise<PromotionCodeResponse> {
    return this._transport.request({
      path: buildPath(PROMOTION_CODES_PATH, promotionCodeId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(
    payload: CreatePromotionCodePayload,
    options?: RequestOptions,
  ): Promise<PromotionCodeResponse> {
    return this._transport.request({
      path: PROMOTION_CODES_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    promotionCodeId: string,
    payload: UpdatePromotionCodePayload,
    options?: RequestOptions,
  ): Promise<PromotionCodeResponse> {
    return this._transport.request({
      path: buildPath(PROMOTION_CODES_PATH, promotionCodeId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
