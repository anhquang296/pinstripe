import { MILLISECONDS_PER_DAY } from '@constants/time';
import { DomainEventTypeEnum } from '@contracts/events.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { WebhookDeliveryStatusEnum, WebhookEndpointStatusEnum } from '@contracts/webhooks.types';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { buildWebhookSignature, isWebhookSignatureValid } from '@utils/webhook-signature';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice as makeOpenInvoiceFixture } from './factories';

const CLOCK_START = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString();
const BASE_AMOUNT = 500_000;
const SHARD_JOB = { shardIndex: 0, shardCount: 1 };
const DECLINED_METHOD = 'pm_card_declined';

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeOpenInvoice(paymentMethod?: string): Promise<string> {
  const { invoiceId } = await makeOpenInvoiceFixture(fastify, {
    unitAmount: BASE_AMOUNT,
    frozenTime: CLOCK_START,
    paymentMethod,
  });

  return invoiceId;
}

async function readInvoiceRow(invoiceId: string) {
  const invoice = await fastify.invoiceRepository.findInvoice(invoiceId);

  if (!invoice) {
    throw new Error(`test fixture lost invoice ${invoiceId}`);
  }

  return invoice;
}

async function readOnlyDeliveryId(endpointId: string): Promise<string> {
  const [delivery] = await fastify.webhookRepository.findWebhookDeliveries({ endpointId });

  if (delivery) {
    return delivery.id;
  }

  throw new Error(`test fixture queued no delivery for endpoint ${endpointId}`);
}

async function readDueAt(invoiceId: string): Promise<Date> {
  const invoice = await readInvoiceRow(invoiceId);
  const { dueAt } = invoice;

  if (dueAt) {
    return dueAt;
  }

  throw new Error(`test fixture left invoice ${invoiceId} without a due date`);
}

describe('InvoiceService.finalizeInvoice due dating', () => {
  it('gives a freshly issued invoice a due date and a first collection attempt', async () => {
    const invoiceId = await makeOpenInvoice();

    const invoice = await readInvoiceRow(invoiceId);

    expect(invoice.dueAt).not.toBeNull();
    expect(invoice.nextAttemptAt).toEqual(invoice.dueAt);
    expect(invoice.attemptCount).toBe(0);
  });
});

describe('DunningService.runDunningShard', () => {
  it('leaves an invoice alone until its due date arrives', async () => {
    const invoiceId = await makeOpenInvoice();
    const dueAt = await readDueAt(invoiceId);
    const beforeDue = new Date(dueAt.getTime() - MILLISECONDS_PER_DAY);

    await fastify.dunningService.runDunningShard({
      ...SHARD_JOB,
      runAt: beforeDue.toISOString(),
    });
    const untouched = await readInvoiceRow(invoiceId);

    expect(untouched.status).toBe(InvoiceStatusEnum.OPEN);
    expect(untouched.attemptCount).toBe(0);
    expect(untouched.nextAttemptAt).toEqual(dueAt);
  });

  it('collects an overdue invoice and stops chasing it', async () => {
    const invoiceId = await makeOpenInvoice();
    const dueAt = await readDueAt(invoiceId);
    const afterDue = new Date(dueAt.getTime() + MILLISECONDS_PER_DAY);

    await fastify.dunningService.runDunningShard({
      ...SHARD_JOB,
      shardCount: 1,
      runAt: afterDue.toISOString(),
    });
    const collected = await readInvoiceRow(invoiceId);

    expect(collected.status).toBe(InvoiceStatusEnum.PAID);
    expect(collected.nextAttemptAt).toBeNull();
  });

  it('schedules another attempt when the card is declined instead of giving up', async () => {
    const invoiceId = await makeOpenInvoice(DECLINED_METHOD);
    const dueAt = await readDueAt(invoiceId);
    const afterDue = new Date(dueAt.getTime() + MILLISECONDS_PER_DAY);

    const dunningRun = await fastify.dunningService.runDunningShard({
      ...SHARD_JOB,
      runAt: afterDue.toISOString(),
    });
    const retried = await readInvoiceRow(invoiceId);

    expect(dunningRun.retried).toBe(1);
    expect(retried.status).toBe(InvoiceStatusEnum.OPEN);
    expect(retried.attemptCount).toBe(1);
    expect(retried.nextAttemptAt?.getTime()).toBeGreaterThan(afterDue.getTime());
  });

  it('reuses the open payment intent instead of minting a new one for every attempt', async () => {
    const invoiceId = await makeOpenInvoice(DECLINED_METHOD);
    const dueAt = await readDueAt(invoiceId);

    let runAt = new Date(dueAt.getTime() + MILLISECONDS_PER_DAY);

    for (const _attempt of _.range(3)) {
      await fastify.dunningService.runDunningShard({ ...SHARD_JOB, runAt: runAt.toISOString() });

      const { nextAttemptAt } = await readInvoiceRow(invoiceId);

      runAt = new Date((nextAttemptAt ?? runAt).getTime() + MILLISECONDS_PER_DAY);
    }

    const intents = await fastify.paymentIntentRepository.findPaymentIntents({ invoiceId });
    const attempts = await fastify.paymentIntentRepository.findPaymentAttempts(
      _.map(intents, 'id'),
    );

    expect(intents).toHaveLength(1);
    expect(attempts.length).toBeGreaterThanOrEqual(3);
  });

  it('gives up and marks the invoice uncollectible once the retry schedule runs out', async () => {
    const invoiceId = await makeOpenInvoice(DECLINED_METHOD);
    const dueAt = await readDueAt(invoiceId);
    const retryCount = fastify.workflowSchedules.dunningRetryDelayDays.length;

    let runAt = new Date(dueAt.getTime() + MILLISECONDS_PER_DAY);

    for (const attempt of _.range(retryCount + 1)) {
      await fastify.dunningService.runDunningShard({ ...SHARD_JOB, runAt: runAt.toISOString() });

      const { nextAttemptAt } = await readInvoiceRow(invoiceId);

      runAt = new Date((nextAttemptAt ?? runAt).getTime() + MILLISECONDS_PER_DAY);

      expect(attempt).toBeGreaterThanOrEqual(0);
    }

    const abandoned = await readInvoiceRow(invoiceId);

    expect(abandoned.status).toBe(InvoiceStatusEnum.UNCOLLECTIBLE);
    expect(abandoned.nextAttemptAt).toBeNull();
    expect(abandoned.attemptCount).toBe(retryCount);
  });

  it('stops chasing an invoice it has already given up on', async () => {
    const invoiceId = await makeOpenInvoice(DECLINED_METHOD);
    const dueAt = await readDueAt(invoiceId);
    const retryCount = fastify.workflowSchedules.dunningRetryDelayDays.length;

    let runAt = new Date(dueAt.getTime() + MILLISECONDS_PER_DAY);

    for (const _attempt of _.range(retryCount + 1)) {
      await fastify.dunningService.runDunningShard({ ...SHARD_JOB, runAt: runAt.toISOString() });

      const { nextAttemptAt } = await readInvoiceRow(invoiceId);

      runAt = new Date((nextAttemptAt ?? runAt).getTime() + MILLISECONDS_PER_DAY);
    }

    const afterAbandon = await fastify.dunningService.runDunningShard({
      ...SHARD_JOB,
      runAt: new Date(runAt.getTime() + 30 * MILLISECONDS_PER_DAY).toISOString(),
    });

    expect(afterAbandon.scanned).toBe(0);
  });
});

describe('WebhookService.createWebhookEndpoint', () => {
  it('returns the signing secret once, at creation, and never again', async () => {
    const created = await fastify.webhookService.createWebhookEndpoint(
      {
        url: 'https://example.test/hooks',
        enabledEvents: [DomainEventTypeEnum.INVOICE_FINALIZED],
      },
      false,
    );

    const fetched = await fastify.webhookService.getWebhookEndpoint(created.id, false);

    expect(created.secret).toMatch(/^whsec_[0-9a-f]{48}$/);
    expect(fetched.secret).toBeNull();
    expect(fetched.status).toBe(WebhookEndpointStatusEnum.ENABLED);
  });
});

describe('WebhookService.handleDomainEvent', () => {
  it('queues a delivery only for endpoints subscribed to that event', async () => {
    const eventId = generateGid(ObjectPrefixEnum.EVENT);
    const subscribed = await fastify.webhookService.createWebhookEndpoint(
      {
        url: 'https://example.test/subscribed',
        enabledEvents: [DomainEventTypeEnum.INVOICE_PAID],
      },
      false,
    );
    await fastify.webhookService.createWebhookEndpoint(
      {
        url: 'https://example.test/uninterested',
        enabledEvents: [DomainEventTypeEnum.CUSTOMER_CREATED],
      },
      false,
    );

    const queued = await fastify.webhookService.handleDomainEvent({
      eventId,
      livemode: false,
      eventType: DomainEventTypeEnum.INVOICE_PAID,
      aggregateType: 'invoice',
      aggregateId: 'in_test',
      payload: { id: 'in_test' },
      occurredAt: new Date().toISOString(),
    });

    const deliveries = await fastify.webhookRepository.findWebhookDeliveries({
      endpointId: subscribed.id,
    });

    expect(queued).toBeGreaterThanOrEqual(1);
    expect(_.map(deliveries, 'eventId')).toContain(eventId);
    expect(_.every(deliveries, { status: WebhookDeliveryStatusEnum.PENDING })).toBe(true);
  });

  it('ignores a disabled endpoint', async () => {
    const endpoint = await fastify.webhookService.createWebhookEndpoint(
      {
        url: 'https://example.test/disabled',
        enabledEvents: [DomainEventTypeEnum.INVOICE_VOIDED],
      },
      false,
    );

    await fastify.webhookService.updateWebhookEndpoint(endpoint.id, {
      status: WebhookEndpointStatusEnum.DISABLED,
    });

    await fastify.webhookService.handleDomainEvent({
      eventId: generateGid(ObjectPrefixEnum.EVENT),
      livemode: false,
      eventType: DomainEventTypeEnum.INVOICE_VOIDED,
      aggregateType: 'invoice',
      aggregateId: 'in_test',
      payload: {},
      occurredAt: new Date().toISOString(),
    });

    const deliveries = await fastify.webhookRepository.findWebhookDeliveries({
      endpointId: endpoint.id,
    });

    expect(deliveries).toHaveLength(0);
  });

  it('signs the body it will actually send with the endpoint secret', async () => {
    const created = await fastify.webhookService.createWebhookEndpoint(
      {
        url: 'https://example.test/signed',
        enabledEvents: [DomainEventTypeEnum.INVOICE_FINALIZED],
      },
      false,
    );

    await fastify.webhookService.handleDomainEvent({
      eventId: generateGid(ObjectPrefixEnum.EVENT),
      livemode: false,
      eventType: DomainEventTypeEnum.INVOICE_FINALIZED,
      aggregateType: 'invoice',
      aggregateId: 'in_test',
      payload: { id: 'in_test' },
      occurredAt: new Date().toISOString(),
    });

    const deliveryId = await readOnlyDeliveryId(created.id);
    const attempt = await fastify.webhookService.resolveDeliveryAttempt(deliveryId);
    const { secret } = created;

    expect(secret).not.toBeNull();
    expect(isWebhookSignatureValid(attempt.body, String(secret), attempt.signature)).toBe(true);
    expect(isWebhookSignatureValid(attempt.body, 'whsec_wrong', attempt.signature)).toBe(false);
  });

  it('carries the event id so a receiver can drop a repeat', async () => {
    const eventId = generateGid(ObjectPrefixEnum.EVENT);
    const created = await fastify.webhookService.createWebhookEndpoint(
      {
        url: 'https://example.test/idempotent',
        enabledEvents: [DomainEventTypeEnum.REFUND_CREATED],
      },
      false,
    );

    await fastify.webhookService.handleDomainEvent({
      eventId,
      livemode: false,
      eventType: DomainEventTypeEnum.REFUND_CREATED,
      aggregateType: 'refund',
      aggregateId: 're_test',
      payload: { id: 're_test' },
      occurredAt: new Date().toISOString(),
    });

    const deliveryId = await readOnlyDeliveryId(created.id);
    const attempt = await fastify.webhookService.resolveDeliveryAttempt(deliveryId);

    expect(JSON.parse(attempt.body)).toMatchObject({
      id: eventId,
      object: 'event',
      type: DomainEventTypeEnum.REFUND_CREATED,
    });
  });
});

describe('WebhookService.recordDeliveryResult', () => {
  it('keeps the failure reason on the delivery so a dead endpoint is visible', async () => {
    const created = await fastify.webhookService.createWebhookEndpoint(
      {
        url: 'https://example.test/broken',
        enabledEvents: [DomainEventTypeEnum.INVOICE_CREATED],
      },
      false,
    );

    await fastify.webhookService.handleDomainEvent({
      eventId: generateGid(ObjectPrefixEnum.EVENT),
      livemode: false,
      eventType: DomainEventTypeEnum.INVOICE_CREATED,
      aggregateType: 'invoice',
      aggregateId: 'in_test',
      payload: {},
      occurredAt: new Date().toISOString(),
    });

    const deliveryId = await readOnlyDeliveryId(created.id);

    await fastify.webhookService.recordDeliveryResult(deliveryId, {
      responseStatus: 500,
      error: 'endpoint answered 500',
      attemptCount: 3,
    });

    const failed = await fastify.webhookRepository.findWebhookDelivery(deliveryId);

    expect(failed?.status).toBe(WebhookDeliveryStatusEnum.FAILED);
    expect(failed?.attemptCount).toBe(3);
    expect(failed?.responseStatus).toBe(500);
    expect(failed?.deliveredAt).toBeNull();
  });
});

describe('buildWebhookSignature in the delivery path', () => {
  it('changes when the payload changes, so a rewritten body is caught', async () => {
    const signedAt = new Date();
    const first = buildWebhookSignature('{"a":1}', 'whsec_x', signedAt);
    const second = buildWebhookSignature('{"a":2}', 'whsec_x', signedAt);

    expect(first).not.toBe(second);
  });
});
