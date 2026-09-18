import { ApiKeyScopeEnum } from '@pinstripe/core/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import { buildAuthHeaders, buildTestApp, mintApiKey } from './context';

let fastify: FastifyInstance;

beforeAll(async () => {
  vi.stubEnv('TEST_CLOCKS_ENABLED', 'false');
  fastify = await buildTestApp();
});

afterAll(async () => {
  await fastify.close();
  vi.unstubAllEnvs();
});

it('returns 404 for the test clock routes when test clocks are disabled', async () => {
  const { token } = await mintApiKey(fastify, [ApiKeyScopeEnum.V1]);

  const response = await fastify.inject({
    method: 'POST',
    url: '/v1/test_helpers/test_clocks',
    headers: buildAuthHeaders(token),
    payload: { name: 'disabled clock', frozenTime: '2026-06-01T00:00:00.000Z' },
  });

  expect(response.statusCode).toBe(404);
});
