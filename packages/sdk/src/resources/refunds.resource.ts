import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CreateRefundPayload,
  FindRefundsQuery,
  ListResponse,
  RefundResponse,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const REFUNDS_PATH = '/v1/refunds';

export class RefundsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  list(
    query: FindRefundsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<RefundResponse>> {
    return this._transport.request({
      path: REFUNDS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  retrieve(refundId: string, options?: RequestOptions): Promise<RefundResponse> {
    return this._transport.request({
      path: buildPath(REFUNDS_PATH, refundId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(payload: CreateRefundPayload, options?: RequestOptions): Promise<RefundResponse> {
    return this._transport.request({
      path: REFUNDS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
