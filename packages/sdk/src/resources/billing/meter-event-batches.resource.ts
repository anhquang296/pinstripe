import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  CreateMeterEventBatchPayload,
  CreateMeterEventBatchResponse,
} from '@type/contracts.types';

const METER_EVENT_BATCHES_PATH = '/v1/billing/meter_event_batches';

export class MeterEventBatchesResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  create(
    payload: CreateMeterEventBatchPayload,
    options?: RequestOptions,
  ): Promise<CreateMeterEventBatchResponse> {
    return this._transport.request({
      path: METER_EVENT_BATCHES_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
