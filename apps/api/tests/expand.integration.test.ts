import {
  CheckoutSessionModeEnum,
  CurrencyEnum,
  RecurringIntervalEnum,
} from '@vxrerp/billing/contracts';
import type { FastifyInstance } from 'fastify';
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

async function makeCustomerId(): Promise<string> {
  const customer = await fastify.customerService.createCustomer({
    name: 'Expand Tester',
    currency: CurrencyEnum.VND,
  });

  return customer.id;
}

it('leaves the response untouched when nothing is expanded', async () => {
  const customerId = await makeCustomerId();

  const response = await fastify.inject({
    method: 'GET',
    url: `/v1/customers/${customerId}`,
    headers: authHeaders,
  });

  expect(response.json()).not.toHaveProperty('customer');
});

it('nests the product object into a price that asks for it', async () => {
  const product = await fastify.productService.createProduct({ name: 'Expandable' });

  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: 1000,
  });

  const response = await fastify.inject({
    method: 'GET',
    url: `/v1/prices/${price.id}?expand[]=product`,
    headers: authHeaders,
  });

  const expanded = response.json();

  expect(expanded.productId).toBe(product.id);
  expect(expanded.product.name).toBe('Expandable');
});

it('nests the customer object into every subscription of a list read', async () => {
  const customer = await fastify.customerService.createCustomer({
    name: 'Expandable subscriber',
    currency: CurrencyEnum.VND,
  });

  const product = await fastify.productService.createProduct({ name: 'Expandable plan' });

  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: 300_000,
    recurring: { interval: RecurringIntervalEnum.MONTH },
  });

  await fastify.subscriptionService.createSubscription({
    customerId: customer.id,
    items: [{ priceId: price.id }],
  });

  const response = await fastify.inject({
    method: 'GET',
    url: `/v1/subscriptions?customerId=${customer.id}&expand[]=customer`,
    headers: authHeaders,
  });

  const [subscription] = response.json().data;

  expect(subscription.customerId).toBe(customer.id);
  expect(subscription.customer.name).toBe('Expandable subscriber');
});

it('nests the customer object into every checkout session of a list read', async () => {
  const customer = await fastify.customerService.createCustomer({
    name: 'Expandable shopper',
    currency: CurrencyEnum.VND,
  });

  const product = await fastify.productService.createProduct({ name: 'Expandable ticket' });

  const price = await fastify.priceService.createPrice({
    productId: product.id,
    currency: CurrencyEnum.VND,
    unitAmount: 50_000,
  });

  await fastify.checkoutService.createCheckoutSession({
    mode: CheckoutSessionModeEnum.PAYMENT,
    customerId: customer.id,
    successUrl: 'https://vexere.test/success',
    lineItems: [{ priceId: price.id }],
  });

  const response = await fastify.inject({
    method: 'GET',
    url: `/v1/checkout/sessions?customerId=${customer.id}&expand[]=customer`,
    headers: authHeaders,
  });

  const [checkoutSession] = response.json().data;

  expect(checkoutSession.customerId).toBe(customer.id);
  expect(checkoutSession.customer.name).toBe('Expandable shopper');
});

it('rejects a property that cannot be expanded', async () => {
  const customerId = await makeCustomerId();

  const response = await fastify.inject({
    method: 'GET',
    url: `/v1/customers/${customerId}?expand[]=subscription`,
    headers: authHeaders,
  });

  expect(response.statusCode).toBe(400);
  expect(response.json().error.param).toBe('expand');
});

it('rejects an expand path deeper than four levels', async () => {
  const customerId = await makeCustomerId();

  const response = await fastify.inject({
    method: 'GET',
    url: `/v1/invoices?customerId=${customerId}&expand[]=a.b.c.d.e`,
    headers: authHeaders,
  });

  expect(response.statusCode).toBe(400);
});
