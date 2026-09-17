import type { RequestOptions } from '@client/pinstripe.types';
import { HttpMethodEnum } from '@client/pinstripe.types';
import type { PinstripeTransport } from '@client/pinstripe-transport';
import type {
  GetWebhookDeliveriesQuery,
  ListResponse,
  WebhookDeliveryResponse,
} from '@type/contracts.types';

const WEBHOOK_DELIVERIES_PATH = '/v1/webhook_deliveries';

export class WebhookDeliveriesResource {
  private _transport: PinstripeTransport;

  constructor(transport: PinstripeTransport) {
    this._transport = transport;
  }

  list(
    query: GetWebhookDeliveriesQuery = {},
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
