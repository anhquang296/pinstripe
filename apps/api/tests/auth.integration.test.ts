import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@vxrerp/billing/contracts';
import { CurrencyEnum } from '@vxrerp/billing/utils';
import { PermissionEnum, VXRERP_API_VERSION } from '@vxrerp/platform/contracts';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ALL_PERMISSIONS, buildAuthHeaders, buildTestApp, mintApiKey } from './context';

const READ_ROUTES = [
  { permission: PermissionEnum.BILLING_READ, url: '/v1/ping' },
  { permission: PermissionEnum.USER_MANAGE, url: '/v1/users' },
  { permission: PermissionEnum.API_KEY_MANAGE, url: '/v1/api_keys' },
] as const;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestApp();
});

afterAll(async () => {
  await fastify.close();
});

describe('bearer token handling', () => {
  it.each(READ_ROUTES)('rejects a missing Authorization header on $url', async ({ url }) => {
    const response = await fastify.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.type).toBe('authentication_error');
  });

  it('rejects an Authorization header that is not a bearer token', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/ping',
      headers: { authorization: 'Basic abc123' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects a bearer token that matches no api key', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/ping',
      headers: buildAuthHeaders('sk_not_a_real_key'),
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('permission enforcement', () => {
  it.each(READ_ROUTES)(
    'accepts a key carrying $permission on $url',
    async ({ permission, url }) => {
      const apiKey = await mintApiKey(fastify, [permission]);

      const response = await fastify.inject({
        method: 'GET',
        url,
        headers: buildAuthHeaders(apiKey.token),
      });

      expect(response.statusCode).toBe(200);
    },
  );

  it('refuses a read-only key on the user routes with 403, not 401', async () => {
    const apiKey = await mintApiKey(fastify, [PermissionEnum.BILLING_READ]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/users',
      headers: buildAuthHeaders(apiKey.token),
    });

    expect(response.statusCode).toBe(403);
  });

  it('refuses a read-only key on a ledger write with 403', async () => {
    const apiKey = await mintApiKey(fastify, [PermissionEnum.BILLING_READ]);

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/ledger/transactions',
      headers: buildAuthHeaders(apiKey.token),
      payload: {
        description: 'permission probe',
        currency: CurrencyEnum.VND,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.CASH,
            direction: PostingDirectionEnum.DEBIT,
            amount: 1000,
          },
          {
            accountCode: LedgerAccountCodeEnum.REVENUE,
            direction: PostingDirectionEnum.CREDIT,
            amount: 1000,
          },
        ],
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('accepts a key that carries several permissions on each of them', async () => {
    const apiKey = await mintApiKey(fastify, [
      PermissionEnum.BILLING_READ,
      PermissionEnum.USER_MANAGE,
    ]);

    const headers = buildAuthHeaders(apiKey.token);

    const pingResponse = await fastify.inject({ method: 'GET', url: '/v1/ping', headers });
    const usersResponse = await fastify.inject({ method: 'GET', url: '/v1/users', headers });

    expect(pingResponse.statusCode).toBe(200);
    expect(usersResponse.statusCode).toBe(200);
  });
});

describe('bootstrap keys from the environment', () => {
  it('keeps the secret key working across the product API', async () => {
    const { SECRET_API_KEY } = fastify.config;

    const headers = buildAuthHeaders(SECRET_API_KEY);

    const pingResponse = await fastify.inject({ method: 'GET', url: '/v1/ping', headers });
    const usersResponse = await fastify.inject({ method: 'GET', url: '/v1/users', headers });

    expect(pingResponse.statusCode).toBe(200);
    expect(usersResponse.statusCode).toBe(200);
  });
});

describe('platform envelope', () => {
  it('stamps every response with the api version', async () => {
    const apiKey = await mintApiKey(fastify, ALL_PERMISSIONS);

    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/ping',
      headers: buildAuthHeaders(apiKey.token),
    });

    expect(response.headers['vxrerp-version']).toBe(VXRERP_API_VERSION);
  });

  it('reports the remaining request budget on every response', async () => {
    const apiKey = await mintApiKey(fastify, ALL_PERMISSIONS);

    const first = await fastify.inject({
      method: 'GET',
      url: '/v1/ping',
      headers: buildAuthHeaders(apiKey.token),
    });

    const second = await fastify.inject({
      method: 'GET',
      url: '/v1/ping',
      headers: buildAuthHeaders(apiKey.token),
    });

    expect(Number(first.headers['ratelimit-remaining'])).toBeGreaterThan(
      Number(second.headers['ratelimit-remaining']),
    );
  });
});

describe('key lifecycle', () => {
  it('stops accepting a key once it is revoked', async () => {
    const apiKey = await mintApiKey(fastify, ALL_PERMISSIONS);
    const headers = buildAuthHeaders(apiKey.token);

    const beforeRevoke = await fastify.inject({ method: 'GET', url: '/v1/ping', headers });

    await fastify.apiKeyService.revokeApiKey(apiKey.id);

    const afterRevoke = await fastify.inject({ method: 'GET', url: '/v1/ping', headers });

    expect(beforeRevoke.statusCode).toBe(200);
    expect(afterRevoke.statusCode).toBe(401);
  });

  it('returns the plaintext token once at creation and never again', async () => {
    const created = await mintApiKey(fastify, ALL_PERMISSIONS);
    const listed = await fastify.apiKeyService.findApiKeys({ limit: 100 });
    const stored = _.find(listed.data, { id: created.id });
    const storedToken = _.get(stored, 'token');

    expect(created.token).toMatch(/^sk_[0-9a-f]{48}$/);
    expect(storedToken).toBeNull();
  });
});
