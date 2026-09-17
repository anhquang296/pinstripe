import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  CreateMeterEventBatchPayload,
  MeterEventBatchResultResponse,
} from '@type/contracts.types';

const METER_EVENT_BATCHES_PATH = '/v1/billing/meter_event_batches';

export class MeterEventBatchesResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  create(
    payload: CreateMeterEventBatchPayload,
    options?: RequestOptions,
  ): Promise<MeterEventBatchResultResponse> {
    return this._transport.request({
      path: METER_EVENT_BATCHES_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
