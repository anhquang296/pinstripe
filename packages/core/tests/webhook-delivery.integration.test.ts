import { DomainEventTypeEnum } from '@contracts/events.types';
import { WebhookDeliveryStatusEnum } from '@contracts/webhooks.types';
import { ConflictError, NotFoundError, TooManyRequestsError } from '@errors/app.error';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { buildTestContext } from './context';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeDelivery(): Promise<string> {
  const endpoint = await fastify.webhookService.createWebhookEndpoint(
    {
      url: 'https://example.test/hooks',
      enabledEvents: [DomainEventTypeEnum.INVOICE_PAID],
    },
    false,
  );

  await fastify.webhookService.handleDomainEvent({
    eventId: generateGid(ObjectPrefixEnum.EVENT),
    livemode: false,
    eventType: DomainEventTypeEnum.INVOICE_PAID,
    aggregateType: 'invoice',
    aggregateId: 'in_test',
    payload: { id: 'in_test' },
    occurredAt: new Date().toISOString(),
  });

  const [delivery] = await fastify.webhookRepository.findWebhookDeliveries({
    endpointId: endpoint.id,
  });

  if (delivery) {
    return delivery.id;
  }

  throw new Error('test fixture queued no delivery');
}

it('marks a delivery exhausted once it burns through the attempt budget', async () => {
  const deliveryId = await makeDelivery();
  const { webhookMaxAttempts } = fastify.workflowSchedules;

  await fastify.webhookService.recordDeliveryResult(deliveryId, {
    responseStatus: 500,
    error: 'boom',
    attemptCount: webhookMaxAttempts - 1,
  });
  const stillRetrying = await fastify.webhookRepository.findWebhookDelivery(deliveryId);

  await fastify.webhookService.recordDeliveryResult(deliveryId, {
    responseStatus: 500,
    error: 'boom',
    attemptCount: webhookMaxAttempts,
  });
  const givenUp = await fastify.webhookRepository.findWebhookDelivery(deliveryId);

  expect(stillRetrying?.status).toBe(WebhookDeliveryStatusEnum.FAILED);
  expect(givenUp?.status).toBe(WebhookDeliveryStatusEnum.EXHAUSTED);
});

it('puts an exhausted delivery back to pending when it is replayed', async () => {
  const deliveryId = await makeDelivery();

  await fastify.webhookService.recordDeliveryResult(deliveryId, {
    responseStatus: 500,
    error: 'boom',
    attemptCount: fastify.workflowSchedules.webhookMaxAttempts,
  });

  const replayed = await fastify.webhookService.replayWebhookDelivery(deliveryId, false);

  expect(replayed.status).toBe(WebhookDeliveryStatusEnum.PENDING);
  expect(replayed.attemptCount).toBe(0);
  expect(replayed.lastError).toBeNull();
});

it('refuses to replay a delivery that is still pending', async () => {
  const deliveryId = await makeDelivery();

  const act = fastify.webhookService.replayWebhookDelivery(deliveryId, false);

  await expect(act).rejects.toThrow(ConflictError);
});

it('refuses to replay a delivery belonging to the other mode', async () => {
  const deliveryId = await makeDelivery();

  await fastify.webhookService.recordDeliveryResult(deliveryId, {
    responseStatus: 500,
    error: 'boom',
    attemptCount: fastify.workflowSchedules.webhookMaxAttempts,
  });

  const act = fastify.webhookService.replayWebhookDelivery(deliveryId, true);

  await expect(act).rejects.toThrow(NotFoundError);
});

it('stops delivering to one endpoint once it is over its rate limit', async () => {
  const deliveryId = await makeDelivery();
  const { webhookEndpointRateLimit } = fastify.workflowSchedules;

  for (const _attempt of _.range(webhookEndpointRateLimit)) {
    await fastify.webhookService.resolveDeliveryAttempt(deliveryId);
  }

  const act = fastify.webhookService.resolveDeliveryAttempt(deliveryId);

  await expect(act).rejects.toThrow(TooManyRequestsError);
});
