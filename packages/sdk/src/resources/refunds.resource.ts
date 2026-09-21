import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  CreateRefundPayload,
  FindRefundsQuery,
  ListResponse,
  RefundResponse,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const REFUNDS_PATH = '/v1/refunds';

export class RefundsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
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

  get(refundId: string, options?: RequestOptions): Promise<RefundResponse> {
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
