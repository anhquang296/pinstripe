import { Endpoint, Method, Params, Payload, Request } from '@api/client';

import type {
  CreateWebhookEndpointPayload,
  GetWebhookDeliveriesQuery,
  GetWebhookEndpointsQuery,
  ListResponse,
  UpdateWebhookEndpointPayload,
  WebhookDeliveryResponse,
  WebhookEndpointResponse,
} from './type';

const WEBHOOK_ENDPOINTS_PATH = '/v1/webhook_endpoints';
const WEBHOOK_DELIVERIES_PATH = '/v1/webhook_deliveries';

export function getWebhookEndpoints(
  query: GetWebhookEndpointsQuery = {},
): Promise<ListResponse<WebhookEndpointResponse>> {
  return Request<ListResponse<WebhookEndpointResponse>>(
    Endpoint(WEBHOOK_ENDPOINTS_PATH),
    Method('GET'),
    Params(query),
  );
}

export function createWebhookEndpoint(
  payload: CreateWebhookEndpointPayload,
): Promise<WebhookEndpointResponse> {
  return Request<WebhookEndpointResponse>(
    Endpoint(WEBHOOK_ENDPOINTS_PATH),
    Method('POST'),
    Payload(payload),
  );
}

export function updateWebhookEndpoint(
  webhookEndpointId: string,
  payload: UpdateWebhookEndpointPayload,
): Promise<WebhookEndpointResponse> {
  return Request<WebhookEndpointResponse>(
    Endpoint(`${WEBHOOK_ENDPOINTS_PATH}/${encodeURIComponent(webhookEndpointId)}`),
    Method('POST'),
    Payload(payload),
  );
}

export function getWebhookDeliveries(
  query: GetWebhookDeliveriesQuery = {},
): Promise<ListResponse<WebhookDeliveryResponse>> {
  return Request<ListResponse<WebhookDeliveryResponse>>(
    Endpoint(WEBHOOK_DELIVERIES_PATH),
    Method('GET'),
    Params(query),
  );
}
