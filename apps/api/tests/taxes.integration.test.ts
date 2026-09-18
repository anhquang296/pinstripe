import {
  ApiKeyScopeEnum,
  CurrencyEnum,
  TaxIdTypeEnum,
  TaxIdVerificationStatusEnum,
  TaxTypeEnum,
} from '@pinstripe/core/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildAuthHeaders, buildTestApp, mintApiKey } from './context';

let fastify: FastifyInstance;
let authHeaders: Record<string, string>;

beforeAll(async () => {
  fastify = await buildTestApp();

  const apiKey = await mintApiKey(fastify, [ApiKeyScopeEnum.V1]);

  authHeaders = buildAuthHeaders(apiKey.token);
});

afterAll(async () => {
  await fastify.close();
});

async function makeCustomerId(): Promise<string> {
  const customer = await fastify.customerService.createCustomer({
    name: 'Tax Route Tester',
    currency: CurrencyEnum.VND,
  });

  return customer.id;
}

it('creates a tax rate and reads it back', async () => {
  const created = await fastify.inject({
    method: 'POST',
    url: '/v1/tax_rates',
    headers: authHeaders,
    payload: {
      displayName: 'VAT 10',
      percentage: 10,
      inclusive: true,
      taxType: TaxTypeEnum.VAT,
      jurisdiction: 'VN',
      country: 'VN',
    },
  });
  const taxRate = created.json();

  const read = await fastify.inject({
    method: 'GET',
    url: `/v1/tax_rates/${taxRate.id}`,
    headers: authHeaders,
  });

  expect(created.statusCode).toBe(201);
  expect(taxRate.id).toMatch(/^txr_/);
  expect(taxRate.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(taxRate).not.toHaveProperty('object');
  expect(taxRate.percentage).toBe(10);
  expect(read.json().id).toBe(taxRate.id);
});

it('refuses a tax rate whose percentage is above one hundred', async () => {
  const response = await fastify.inject({
    method: 'POST',
    url: '/v1/tax_rates',
    headers: authHeaders,
    payload: {
      displayName: 'Absurd',
      percentage: 120,
      inclusive: false,
      taxType: TaxTypeEnum.VAT,
    },
  });

  expect(response.statusCode).toBe(400);
});

it('deactivates a tax rate without touching its percentage', async () => {
  const created = await fastify.inject({
    method: 'POST',
    url: '/v1/tax_rates',
    headers: authHeaders,
    payload: {
      displayName: 'VAT 8',
      percentage: 8,
      inclusive: false,
      taxType: TaxTypeEnum.VAT,
    },
  });
  const taxRate = created.json();

  const updated = await fastify.inject({
    method: 'POST',
    url: `/v1/tax_rates/${taxRate.id}`,
    headers: authHeaders,
    payload: { active: false },
  });

  expect(updated.json().active).toBe(false);
  expect(updated.json().percentage).toBe(8);
});

it('creates a tax id that starts out pending verification', async () => {
  const customerId = await makeCustomerId();

  const response = await fastify.inject({
    method: 'POST',
    url: '/v1/tax_ids',
    headers: authHeaders,
    payload: { customerId, type: TaxIdTypeEnum.VN_TIN, value: '0123456789', country: 'VN' },
  });
  const taxId = response.json();

  expect(response.statusCode).toBe(201);
  expect(taxId.verification.status).toBe(TaxIdVerificationStatusEnum.PENDING);
  expect(taxId.verification.verifiedName).toBeNull();
});

it('nests the customer object into a tax id that asks for it', async () => {
  const customerId = await makeCustomerId();
  const created = await fastify.inject({
    method: 'POST',
    url: '/v1/tax_ids',
    headers: authHeaders,
    payload: { customerId, type: TaxIdTypeEnum.US_EIN, value: '12-3456789' },
  });
  const taxId = created.json();

  const response = await fastify.inject({
    method: 'GET',
    url: `/v1/tax_ids/${taxId.id}?expand[]=customer`,
    headers: authHeaders,
  });
  const expanded = response.json();

  expect(expanded.customerId).toBe(customerId);
  expect(expanded.customer.name).toBe('Tax Route Tester');
});

it('refuses a second identical tax id for the same customer', async () => {
  const customerId = await makeCustomerId();
  const payload = { customerId, type: TaxIdTypeEnum.EU_VAT, value: 'DE987654321' };

  await fastify.inject({ method: 'POST', url: '/v1/tax_ids', headers: authHeaders, payload });

  const response = await fastify.inject({
    method: 'POST',
    url: '/v1/tax_ids',
    headers: authHeaders,
    payload,
  });

  expect(response.statusCode).toBe(409);
});

it('reports a deleted tax id as gone', async () => {
  const customerId = await makeCustomerId();
  const created = await fastify.inject({
    method: 'POST',
    url: '/v1/tax_ids',
    headers: authHeaders,
    payload: { customerId, type: TaxIdTypeEnum.OTHER, value: 'internal-42' },
  });
  const taxId = created.json();

  const deleted = await fastify.inject({
    method: 'DELETE',
    url: `/v1/tax_ids/${taxId.id}`,
    headers: authHeaders,
  });
  const read = await fastify.inject({
    method: 'GET',
    url: `/v1/tax_ids/${taxId.id}`,
    headers: authHeaders,
  });

  expect(deleted.json()).toEqual({ id: taxId.id, deleted: true });
  expect(read.statusCode).toBe(404);
});
