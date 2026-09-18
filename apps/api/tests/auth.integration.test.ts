import { ApiKeyScopeEnum, PINSTRIPE_API_VERSION } from '@pinstripe/core/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildAuthHeaders, buildTestApp, mintApiKey } from './context';

const SURFACES = [
  { scope: ApiKeyScopeEnum.V1, url: '/v1/ping' },
  { scope: ApiKeyScopeEnum.ADMIN, url: '/api/v1/admin/ping' },
  { scope: ApiKeyScopeEnum.SYSTEM, url: '/api/v1/system/ping' },
] as const;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestApp();
});

afterAll(async () => {
  await fastify.close();
});

describe('bearer token handling', () => {
  it.each(SURFACES)('rejects a missing Authorization header on $url', async ({ url }) => {
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

describe('scope enforcement', () => {
  it.each(SURFACES)('accepts a key carrying the $scope scope on $url', async ({ scope, url }) => {
    const apiKey = await mintApiKey(fastify, [scope]);

    const response = await fastify.inject({
      method: 'GET',
      url,
      headers: buildAuthHeaders(apiKey.token),
    });

    expect(response.statusCode).toBe(200);
  });

  it('refuses a v1 key on the admin surface with 403, not 401', async () => {
    const apiKey = await mintApiKey(fastify, [ApiKeyScopeEnum.V1]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/ping',
      headers: buildAuthHeaders(apiKey.token),
    });

    expect(response.statusCode).toBe(403);
  });

  it('refuses an admin key on the v1 surface with 403', async () => {
    const apiKey = await mintApiKey(fastify, [ApiKeyScopeEnum.ADMIN]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/ping',
      headers: buildAuthHeaders(apiKey.token),
    });

    expect(response.statusCode).toBe(403);
  });

  it('accepts a key that carries several scopes on each of them', async () => {
    const apiKey = await mintApiKey(fastify, [ApiKeyScopeEnum.V1, ApiKeyScopeEnum.ADMIN]);
    const headers = buildAuthHeaders(apiKey.token);

    const v1Response = await fastify.inject({ method: 'GET', url: '/v1/ping', headers });
    const adminResponse = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/ping',
      headers,
    });

    expect(v1Response.statusCode).toBe(200);
    expect(adminResponse.statusCode).toBe(200);
  });
});

describe('bootstrap keys from the environment', () => {
  it('keeps the four environment keys working on their own surface', async () => {
    const { SECRET_API_KEY, ADMIN_API_KEY, MANAGEMENT_API_KEY } = fastify.config;

    const v1Response = await fastify.inject({
      method: 'GET',
      url: '/v1/ping',
      headers: buildAuthHeaders(SECRET_API_KEY),
    });
    const adminResponse = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/ping',
      headers: buildAuthHeaders(ADMIN_API_KEY),
    });
    const crossSurfaceResponse = await fastify.inject({
      method: 'GET',
      url: '/api/v1/admin/ping',
      headers: buildAuthHeaders(MANAGEMENT_API_KEY),
    });

    expect(v1Response.statusCode).toBe(200);
    expect(adminResponse.statusCode).toBe(200);
    expect(crossSurfaceResponse.statusCode).toBe(403);
  });
});

describe('platform envelope', () => {
  it('stamps every response with the api version', async () => {
    const apiKey = await mintApiKey(fastify, [ApiKeyScopeEnum.V1]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/ping',
      headers: buildAuthHeaders(apiKey.token),
    });

    expect(response.headers['pinstripe-version']).toBe(PINSTRIPE_API_VERSION);
  });

  it('reports the remaining request budget on every response', async () => {
    const apiKey = await mintApiKey(fastify, [ApiKeyScopeEnum.V1]);

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
    const apiKey = await mintApiKey(fastify, [ApiKeyScopeEnum.V1]);
    const headers = buildAuthHeaders(apiKey.token);

    const beforeRevoke = await fastify.inject({ method: 'GET', url: '/v1/ping', headers });

    await fastify.apiKeyService.revokeApiKey(apiKey.id);

    const afterRevoke = await fastify.inject({ method: 'GET', url: '/v1/ping', headers });

    expect(beforeRevoke.statusCode).toBe(200);
    expect(afterRevoke.statusCode).toBe(401);
  });

  it('returns the plaintext token once at creation and never again', async () => {
    const created = await mintApiKey(fastify, [ApiKeyScopeEnum.ADMIN]);
    const listed = await fastify.apiKeyService.findApiKeys({ limit: 100 });
    const stored = listed.data.find((apiKey) => {
      return apiKey.id === created.id;
    });

    expect(created.token).toMatch(/^sk_[0-9a-f]{48}$/);
    expect(stored?.token).toBeNull();
  });
});
