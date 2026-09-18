import { ApiKeyScopeEnum, ApiKeyTypeEnum, CurrencyEnum } from '@pinstripe/core/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildAuthHeaders, buildTestApp, mintApiKey } from './context';

let fastify: FastifyInstance;
let portalKeyHeaders: Record<string, string>;

beforeAll(async () => {
  fastify = await buildTestApp();

  const portalKey = await mintApiKey(fastify, [ApiKeyScopeEnum.PORTAL], {
    type: ApiKeyTypeEnum.PUBLISHABLE,
  });

  portalKeyHeaders = buildAuthHeaders(portalKey.token);
});

afterAll(async () => {
  await fastify.close();
});

async function makeCustomer(email: string): Promise<string> {
  const customer = await fastify.customerService.createCustomer({
    email,
    currency: CurrencyEnum.VND,
    name: 'Portal Tester',
  });

  return customer.id;
}

async function makeSessionHeaders(email: string): Promise<Record<string, string>> {
  await makeCustomer(email);

  const link = await fastify.portalSessionService.createPortalLink({ email });
  const redeemed = await fastify.inject({
    method: 'POST',
    url: '/portal/sessions',
    headers: portalKeyHeaders,
    payload: { linkKey: String(link.linkKey) },
  });

  return buildAuthHeaders(String(redeemed.json().sessionKey));
}

describe('portal link surface', () => {
  it('accepts a publishable key and answers the same way for an unknown address', async () => {
    const known = await fastify.inject({
      method: 'POST',
      url: '/portal/links',
      headers: portalKeyHeaders,
      payload: { email: 'known@portal.test' },
    });
    const unknown = await fastify.inject({
      method: 'POST',
      url: '/portal/links',
      headers: portalKeyHeaders,
      payload: { email: 'unknown@portal.test' },
    });

    expect(known.statusCode).toBe(202);
    expect(unknown.statusCode).toBe(202);
    expect(Object.keys(known.json()).sort()).toEqual(Object.keys(unknown.json()).sort());
  });

  it('rejects a secret key that carries no portal scope', async () => {
    const secretKey = await mintApiKey(fastify, [ApiKeyScopeEnum.V1]);

    const response = await fastify.inject({
      method: 'POST',
      url: '/portal/links',
      headers: buildAuthHeaders(secretKey.token),
      payload: { email: 'known@portal.test' },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('portal account surface', () => {
  it('answers /portal/me for the customer behind the session key', async () => {
    const email = 'me@portal.test';
    const headers = await makeSessionHeaders(email);

    const response = await fastify.inject({ method: 'GET', url: '/portal/me', headers });

    expect(response.statusCode).toBe(200);
    expect(response.json().email).toBe(email);
  });

  it('reads only the invoices of the session customer, whatever the query says', async () => {
    const otherCustomerId = await makeCustomer('other@portal.test');
    const headers = await makeSessionHeaders('owner@portal.test');

    const response = await fastify.inject({
      method: 'GET',
      url: `/portal/invoices?customerId=${otherCustomerId}`,
      headers,
    });

    expect(response.statusCode).toBe(400);
  });

  it('refuses a request with no session key', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/portal/me' });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a publishable key where a session key belongs', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/portal/me',
      headers: portalKeyHeaders,
    });

    expect(response.statusCode).toBe(401);
  });

  it('stops answering once the session is revoked', async () => {
    const headers = await makeSessionHeaders('logout@portal.test');

    const revoked = await fastify.inject({ method: 'DELETE', url: '/portal/sessions', headers });
    const afterwards = await fastify.inject({ method: 'GET', url: '/portal/me', headers });

    expect(revoked.statusCode).toBe(200);
    expect(afterwards.statusCode).toBe(401);
  });
});

describe('merchant billing portal session', () => {
  it('opens a portal session the customer can use through /portal/me', async () => {
    const email = 'merchant-opened@portal.test';
    const customerId = await makeCustomer(email);
    const secretKey = await mintApiKey(fastify, [ApiKeyScopeEnum.V1]);

    const created = await fastify.inject({
      method: 'POST',
      url: '/v1/billing_portal/sessions',
      headers: buildAuthHeaders(secretKey.token),
      payload: { customerId },
    });
    const sessionKey = new URL(created.json().url).searchParams.get('sessionKey');
    const me = await fastify.inject({
      method: 'GET',
      url: '/portal/me',
      headers: buildAuthHeaders(String(sessionKey)),
    });

    expect(created.statusCode).toBe(201);
    expect(sessionKey).not.toBeNull();
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe(email);
  });

  it('refuses a publishable portal key on the merchant route', async () => {
    const customerId = await makeCustomer('merchant-refused@portal.test');

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/billing_portal/sessions',
      headers: portalKeyHeaders,
      payload: { customerId },
    });

    expect(response.statusCode).toBe(403);
  });
});
