import { OutboxStatusEnum } from '@contracts/events.types';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';

const POLL_INTERVAL_MS = 100;
const POLL_ATTEMPTS = 100;
const RELAY_BATCH_SIZE = 500;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function waitForPublished(eventId: string): Promise<string | undefined> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    await fastify.outboxService.relayOutboxEvents(RELAY_BATCH_SIZE);

    const event = await fastify.outboxEventRepository.findOutboxEvent(eventId);

    if (event?.status === OutboxStatusEnum.PUBLISHED) {
      return event.status;
    }

    await new Promise((resolve) => {
      return setTimeout(resolve, POLL_INTERVAL_MS);
    });
  }

  return undefined;
}

describe('OutboxService.relayOutboxEvents', () => {
  it('publishes a recorded event and leaves nothing claimable behind', async () => {
    const aggregateId = generateGid(ObjectPrefixEnum.CUSTOMER);

    const [eventId = ''] = await fastify.outboxService.recordEvents([
      {
        aggregateType: 'customer',
        aggregateId,
        eventType: 'customer.created',
        payload: { id: aggregateId },
      },
    ]);

    const status = await waitForPublished(eventId);

    expect(status).toBe(OutboxStatusEnum.PUBLISHED);
  });
});
