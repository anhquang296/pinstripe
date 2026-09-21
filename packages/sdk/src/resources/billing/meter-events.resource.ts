import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type { CreateMeterEventPayload, MeterEventResponse } from '@type/contracts.types';

const METER_EVENTS_PATH = '/v1/billing/meter_events';

export class MeterEventsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  create(payload: CreateMeterEventPayload, options?: RequestOptions): Promise<MeterEventResponse> {
    return this._transport.request({
      path: METER_EVENTS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
