import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  CreateMeterPayload,
  FindMetersQuery,
  GetMeterEventSummaryQuery,
  ListResponse,
  MeterEventSummaryResponse,
  MeterResponse,
  UpdateMeterPayload,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const METERS_PATH = '/v1/billing/meters';

export class MetersResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindMetersQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<MeterResponse>> {
    return this._transport.request({
      path: METERS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(meterId: string, options?: RequestOptions): Promise<MeterResponse> {
    return this._transport.request({
      path: buildPath(METERS_PATH, meterId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(payload: CreateMeterPayload, options?: RequestOptions): Promise<MeterResponse> {
    return this._transport.request({
      path: METERS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    meterId: string,
    payload: UpdateMeterPayload,
    options?: RequestOptions,
  ): Promise<MeterResponse> {
    return this._transport.request({
      path: buildPath(METERS_PATH, meterId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  getEventSummary(
    meterId: string,
    query: GetMeterEventSummaryQuery,
    options?: RequestOptions,
  ): Promise<MeterEventSummaryResponse> {
    return this._transport.request({
      path: buildPath(METERS_PATH, meterId, 'event_summaries'),
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }
}
