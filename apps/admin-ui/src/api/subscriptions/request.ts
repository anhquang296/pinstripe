import { Endpoint, Method, Params, Payload, Request } from '@api/client';

import type {
  CancelSubscriptionPayload,
  CreateSubscriptionPayload,
  GetSubscriptionsQuery,
  ListResponse,
  SubscriptionResponse,
  UpdateSubscriptionPayload,
} from './type';

const SUBSCRIPTIONS_PATH = '/v1/subscriptions';

export function getSubscriptions(
  query: GetSubscriptionsQuery = {},
): Promise<ListResponse<SubscriptionResponse>> {
  return Request<ListResponse<SubscriptionResponse>>(
    Endpoint(SUBSCRIPTIONS_PATH),
    Method('GET'),
    Params(query),
  );
}

export function getSubscription(subscriptionId: string): Promise<SubscriptionResponse> {
  return Request<SubscriptionResponse>(
    Endpoint(`${SUBSCRIPTIONS_PATH}/${encodeURIComponent(subscriptionId)}`),
    Method('GET'),
  );
}

export function createSubscription(
  payload: CreateSubscriptionPayload,
): Promise<SubscriptionResponse> {
  return Request<SubscriptionResponse>(
    Endpoint(SUBSCRIPTIONS_PATH),
    Method('POST'),
    Payload(payload),
  );
}

export function updateSubscription(
  subscriptionId: string,
  payload: UpdateSubscriptionPayload,
): Promise<SubscriptionResponse> {
  return Request<SubscriptionResponse>(
    Endpoint(`${SUBSCRIPTIONS_PATH}/${encodeURIComponent(subscriptionId)}`),
    Method('POST'),
    Payload(payload),
  );
}

export function cancelSubscription(
  subscriptionId: string,
  payload: CancelSubscriptionPayload,
): Promise<SubscriptionResponse> {
  return Request<SubscriptionResponse>(
    Endpoint(`${SUBSCRIPTIONS_PATH}/${encodeURIComponent(subscriptionId)}`),
    Method('DELETE'),
    Payload(payload),
  );
}
