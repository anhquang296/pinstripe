import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';
import { buildTestContext } from './context';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

describe('OutboxService.relayOutboxEvents', () => {
  it('dispatches a recorded event once and marks it published', async () => {
    const aggregateId = generateId(ObjectPrefixEnum.CUSTOMER);
    await fastify.outboxService.recordEvents([
      {
        aggregateType: 'customer',
        aggregateId,
        eventType: 'customer.created',
        payload: { id: aggregateId },
      },
    ]);

    const relayed = await fastify.outboxService.relayOutboxEvents(100);
    const relayedAgain = await fastify.outboxService.relayOutboxEvents(100);

    expect(relayed).toBeGreaterThanOrEqual(1);
    expect(relayedAgain).toBe(0);
  });
});
