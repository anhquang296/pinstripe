import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type { CreateMeterEventPayload, MeterEventResponse } from '@type/contracts.types';

const METER_EVENTS_PATH = '/v1/billing/meter_events';

export class MeterEventsResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
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
