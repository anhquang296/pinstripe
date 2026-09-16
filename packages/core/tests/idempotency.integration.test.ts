import { IdempotencyConflictError, IdempotencyInProgressError } from '@errors/idempotency.error';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

function buildRequest(key: string, body: unknown) {
  return { scope: 'test', key, route: '/v1/customers', body };
}

describe('IdempotencyService.beginRequest', () => {
  it('returns no replay for a key seen for the first time', async () => {
    const key = generateGid(ObjectPrefixEnum.REQUEST);

    const ticket = await fastify.idempotencyService.beginRequest(buildRequest(key, { name: 'a' }));

    expect(ticket.replay).toBeNull();
  });

  it('replays the stored response for a repeated key with the same body', async () => {
    const key = generateGid(ObjectPrefixEnum.REQUEST);
    const first = await fastify.idempotencyService.beginRequest(buildRequest(key, { name: 'a' }));
    await fastify.idempotencyService.completeRequest(first.id, 201, { id: 'cus_1' });

    const second = await fastify.idempotencyService.beginRequest(buildRequest(key, { name: 'a' }));

    expect(second.replay).toEqual({ statusCode: 201, body: { id: 'cus_1' } });
  });

  it('rejects a repeated key whose request body differs', async () => {
    const key = generateGid(ObjectPrefixEnum.REQUEST);
    const first = await fastify.idempotencyService.beginRequest(buildRequest(key, { name: 'a' }));
    await fastify.idempotencyService.completeRequest(first.id, 201, { id: 'cus_1' });

    const act = fastify.idempotencyService.beginRequest(buildRequest(key, { name: 'b' }));

    await expect(act).rejects.toThrowError(IdempotencyConflictError);
  });

  it('rejects a repeated key while the first request is still running', async () => {
    const key = generateGid(ObjectPrefixEnum.REQUEST);
    await fastify.idempotencyService.beginRequest(buildRequest(key, { name: 'a' }));

    const act = fastify.idempotencyService.beginRequest(buildRequest(key, { name: 'a' }));

    await expect(act).rejects.toThrowError(IdempotencyInProgressError);
  });
});
