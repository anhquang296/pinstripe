import type { PriceResponse, SubscriptionResponse } from '@vxrerp/core/contracts';
import { CurrencyEnum, RecurringIntervalEnum } from '@vxrerp/core/contracts';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { ALL_PERMISSIONS, buildAuthHeaders, buildTestApp, mintApiKey } from './context';

let fastify: FastifyInstance;
let authHeaders: Record<string, string>;

beforeAll(async () => {
  fastify = await buildTestApp();

  const apiKey = await mintApiKey(fastify, ALL_PERMISSIONS);

  authHeaders = buildAuthHeaders(apiKey.token);
});

afterAll(async () => {
  await fastify.close();
});

async function makePrice(): Promise<PriceResponse> {
  const product = await fastify.productService.createProduct({
    name: 'Subscription item route plan',
  });

  return fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: 300_000,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });
}

async function makeSubscription(priceId: string): Promise<SubscriptionResponse> {
  const customer = await fastify.customerService.createCustomer({
    name: 'Subscription item route tester',
    currency: CurrencyEnum.VND,
  });

  return fastify.subscriptionService.createSubscription({
    customerId: customer.id,
    items: [{ priceId }],
  });
}

it('adds an item to a subscription and lists it back', async () => {
  const price = await makePrice();
  const subscription = await makeSubscription(price.id);
  const secondPrice = await makePrice();

  const created = await fastify.inject({
    method: 'POST',
    url: '/v1/subscription_items',
    headers: authHeaders,
    payload: { subscriptionId: subscription.id, priceId: secondPrice.id, quantity: 2 },
  });

  const listed = await fastify.inject({
    method: 'GET',
    url: `/v1/subscription_items?subscriptionId=${subscription.id}`,
    headers: authHeaders,
  });

  expect(created.statusCode).toBe(201);
  expect(created.json().id).toMatch(/^si_/);
  expect(created.json().quantity).toBe(2);
  expect(listed.json().data).toHaveLength(2);
});

it('keeps the item id when the quantity is updated', async () => {
  const price = await makePrice();
  const subscription = await makeSubscription(price.id);

  const [item] = subscription.items;

  const itemId = _.get(item, 'id');

  const updated = await fastify.inject({
    method: 'POST',
    url: `/v1/subscription_items/${itemId}`,
    headers: authHeaders,
    payload: { quantity: 5 },
  });

  expect(updated.statusCode).toBe(200);
  expect(updated.json().id).toBe(itemId);
  expect(updated.json().quantity).toBe(5);
});

it('refuses to delete the only item of a subscription', async () => {
  const price = await makePrice();
  const subscription = await makeSubscription(price.id);

  const [item] = subscription.items;

  const itemId = _.get(item, 'id');

  const response = await fastify.inject({
    method: 'DELETE',
    url: `/v1/subscription_items/${itemId}`,
    headers: authHeaders,
    payload: {},
  });

  expect(response.statusCode).toBe(409);
});

it('answers 404 for a subscription item that does not exist', async () => {
  const response = await fastify.inject({
    method: 'GET',
    url: '/v1/subscription_items/si_missing',
    headers: authHeaders,
  });

  expect(response.statusCode).toBe(404);
});
