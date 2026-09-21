import type { RequestOptions } from '@client/vxr-erp.types';
import { HttpMethodEnum } from '@client/vxr-erp.types';
import type { VxrErpTransport } from '@client/vxr-erp-transport';
import type {
  CreateWebhookEndpointPayload,
  FindWebhookEndpointsQuery,
  ListResponse,
  UpdateWebhookEndpointPayload,
  WebhookEndpointResponse,
} from '@type/contracts.types';
import { buildPath } from '@utils/build-path';

const WEBHOOK_ENDPOINTS_PATH = '/v1/webhook_endpoints';

export class WebhookEndpointsResource {
  private _transport: VxrErpTransport;

  constructor(transport: VxrErpTransport) {
    this._transport = transport;
  }

  find(
    query: FindWebhookEndpointsQuery = {},
    options?: RequestOptions,
  ): Promise<ListResponse<WebhookEndpointResponse>> {
    return this._transport.request({
      path: WEBHOOK_ENDPOINTS_PATH,
      method: HttpMethodEnum.GET,
      query,
      options,
    });
  }

  get(webhookEndpointId: string, options?: RequestOptions): Promise<WebhookEndpointResponse> {
    return this._transport.request({
      path: buildPath(WEBHOOK_ENDPOINTS_PATH, webhookEndpointId),
      method: HttpMethodEnum.GET,
      options,
    });
  }

  create(
    payload: CreateWebhookEndpointPayload,
    options?: RequestOptions,
  ): Promise<WebhookEndpointResponse> {
    return this._transport.request({
      path: WEBHOOK_ENDPOINTS_PATH,
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }

  update(
    webhookEndpointId: string,
    payload: UpdateWebhookEndpointPayload,
    options?: RequestOptions,
  ): Promise<WebhookEndpointResponse> {
    return this._transport.request({
      path: buildPath(WEBHOOK_ENDPOINTS_PATH, webhookEndpointId),
      method: HttpMethodEnum.POST,
      payload,
      options,
    });
  }
}
