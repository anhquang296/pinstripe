import type {
  CancelSubscriptionPayload,
  CreateSubscriptionPayload,
  GetSubscriptionsQuery,
  ListResponse,
  Subscription,
  UpdateSubscriptionPayload,
} from '@pinstripe/core/contracts';
import { Endpoint, Method, Params, Payload, Request } from '@api/request';

const SUBSCRIPTIONS_PATH = '/v1/subscriptions';

export function getSubscriptions(
  query: GetSubscriptionsQuery = {},
): Promise<ListResponse<Subscription>> {
  return Request<ListResponse<Subscription>>(
    Endpoint(SUBSCRIPTIONS_PATH),
    Method('GET'),
    Params(query as Record<string, unknown>),
  );
}

export function getSubscription(subscriptionId: string): Promise<Subscription> {
  return Request<Subscription>(
    Endpoint(`${SUBSCRIPTIONS_PATH}/${encodeURIComponent(subscriptionId)}`),
    Method('GET'),
  );
}

export function createSubscription(payload: CreateSubscriptionPayload): Promise<Subscription> {
  return Request<Subscription>(
    Endpoint(SUBSCRIPTIONS_PATH),
    Method('POST'),
    Payload(payload as Record<string, unknown>),
  );
}

export function updateSubscription(
  subscriptionId: string,
  payload: UpdateSubscriptionPayload,
): Promise<Subscription> {
  return Request<Subscription>(
    Endpoint(`${SUBSCRIPTIONS_PATH}/${encodeURIComponent(subscriptionId)}`),
    Method('POST'),
    Payload(payload as Record<string, unknown>),
  );
}

export function cancelSubscription(
  subscriptionId: string,
  payload: CancelSubscriptionPayload,
): Promise<Subscription> {
  return Request<Subscription>(
    Endpoint(`${SUBSCRIPTIONS_PATH}/${encodeURIComponent(subscriptionId)}`),
    Method('DELETE'),
    Payload(payload as Record<string, unknown>),
  );
}
