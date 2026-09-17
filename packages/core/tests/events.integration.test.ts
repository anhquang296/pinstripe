import { PINSTRIPE_API_VERSION } from '@constants/api-version';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import { NotFoundError } from '@errors/app.error';
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

async function recordAndRelay(livemode: boolean): Promise<string> {
  const aggregateId = generateGid(ObjectPrefixEnum.CUSTOMER);
  const [eventId] = await fastify.outboxService.recordEvents([
    {
      aggregateType: AggregateTypeEnum.CUSTOMER,
      aggregateId,
      livemode,
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
  const eventId = await recordAndRelay(false);

  const event = await fastify.eventService.getEvent(eventId, false);

  expect(event.object).toBe('event');
  expect(event.type).toBe(DomainEventTypeEnum.CUSTOMER_CREATED);
  expect(event.apiVersion).toBe(PINSTRIPE_API_VERSION);
  expect(event.livemode).toBe(false);
  expect(event.data.object).toMatchObject({ id: expect.stringMatching(/^cus_/) });
});

it('hides an event from the other mode', async () => {
  const liveEventId = await recordAndRelay(true);

  const act = fastify.eventService.getEvent(liveEventId, false);

  await expect(act).rejects.toThrow(NotFoundError);
});

it('lists only the events of the calling mode', async () => {
  const testEventId = await recordAndRelay(false);
  const liveEventId = await recordAndRelay(true);

  const listed = await fastify.eventService.findEvents({ limit: 100 }, false);
  const ids = listed.data.map((event) => {
    return event.id;
  });

  expect(ids).toContain(testEventId);
  expect(ids).not.toContain(liveEventId);
});

it('keeps the event id the webhook delivery references', async () => {
  const eventId = await recordAndRelay(false);

  const event = await fastify.eventService.getEvent(eventId, false);

  expect(event.id).toBe(eventId);
});
