import { CurrencyEnum } from '@pinstripe/core/contracts';
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
