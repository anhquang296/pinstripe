import { PINSTRIPE_API_VERSION } from '@constants/api-version';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildTestContext } from './context';

const RELAY_BATCH_SIZE = 50;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function recordAndRelay(): Promise<string> {
  const aggregateId = generateGid(ObjectPrefixEnum.CUSTOMER);

  const [eventId] = await fastify.outboxService.recordEvents([
    {
      aggregateType: AggregateTypeEnum.CUSTOMER,
      aggregateId,
      eventType: DomainEventTypeEnum.CUSTOMER_CREATED,
      payload: { id: aggregateId },
    },
  ]);

  await fastify.outboxService.relayOutboxEvents(RELAY_BATCH_SIZE);

  if (eventId) {
    return eventId;
  }

  throw new Error('test fixture recorded no event');
}

it('materialises a public event when the outbox relays a domain event', async () => {
  const eventId = await recordAndRelay();

  const event = await fastify.eventService.getEvent(eventId);

  expect(event.id).toMatch(/^evt_/);
  expect(event).not.toHaveProperty('object');
  expect(event.type).toBe(DomainEventTypeEnum.CUSTOMER_CREATED);
  expect(event.apiVersion).toBe(PINSTRIPE_API_VERSION);
  expect(event.data.object).toMatchObject({ id: expect.stringMatching(/^cus_/) });
});

it('keeps the event id the webhook delivery references', async () => {
  const eventId = await recordAndRelay();

  const event = await fastify.eventService.getEvent(eventId);

  expect(event.id).toBe(eventId);
});
