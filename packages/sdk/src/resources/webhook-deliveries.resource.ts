import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  FindWebhookDeliveriesQuery,
  ListResponse,
  WebhookDeliveryResponse,
} from '@type/contracts.types';

const WEBHOOK_DELIVERIES_PATH = '/v1/webhook_deliveries';

export class WebhookDeliveriesResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindWebhookDeliveriesQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<WebhookDeliveryResponse>> {
    return this._transport.request({
      path: WEBHOOK_DELIVERIES_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }
}
