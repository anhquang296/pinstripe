import { PspTokenEnum } from '@clients/mock-psp.client';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { DECLINE_TAXONOMY, DeclineCodeEnum } from '@contracts/payments.types';
import { MILLISECONDS_PER_DAY } from '@vxrerp/platform/constants';
import {
  DomainEventTypeEnum,
  ErpModuleEnum,
  WebhookDeliveryStatusEnum,
  WebhookEndpointStatusEnum,
} from '@vxrerp/platform/contracts';
import {
  buildWebhookSignature,
  generateGid,
  isWebhookSignatureValid,
  ObjectPrefixEnum,
} from '@vxrerp/platform/utils';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestContext } from './context';
import { makeOpenInvoice as makeOpenInvoiceFixture } from './factories';

const CLOCK_START = new Date(Date.now() - 2 * MILLISECONDS_PER_DAY).toISOString();
const BASE_AMOUNT = 500_000;
const SHARD_JOB = { shardIndex: 0, shardCount: 1 };
const CLOCK_SLACK_MS = 30_000;

let fastify: FastifyInstance;

beforeAll(async () => {
  fastify = await buildTestContext();
});

afterAll(async () => {
  await fastify.close();
});

async function makeOpenInvoice(token?: string): Promise<string> {
  const { invoiceId } = await makeOpenInvoiceFixture(fastify, {
    unitAmount: BASE_AMOUNT,
    frozenTime: CLOCK_START,
    token,
  });

  return invoiceId;
}

async function runShard(runAt: Date) {
  const dunningRun = await fastify.dunningService.runDunningShard({
    ...SHARD_JOB,
    runAt: runAt.toISOString(),
  });

  await fastify.paymentService.drainProviderEvents();

  return dunningRun;
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
    return new Date(dueAt);
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

    await runShard(beforeDue);
    const untouched = await readInvoiceRow(invoiceId);

    expect(untouched.status).toBe(InvoiceStatusEnum.OPEN);
    expect(untouched.attemptCount).toBe(0);
    expect(untouched.nextAttemptAt).toBe(dueAt.toISOString());
  });

  it('collects an overdue invoice and stops chasing it', async () => {
    const invoiceId = await makeOpenInvoice();
    const dueAt = await readDueAt(invoiceId);

    await runShard(new Date(dueAt.getTime() + MILLISECONDS_PER_DAY));
    const collected = await readInvoiceRow(invoiceId);

    expect(collected.status).toBe(InvoiceStatusEnum.PAID);
    expect(collected.nextAttemptAt).toBeNull();
  });

  it('parks the invoice while the confirmation is still in flight instead of charging twice', async () => {
    const invoiceId = await makeOpenInvoice();
    const dueAt = await readDueAt(invoiceId);
    const afterDue = new Date(dueAt.getTime() + MILLISECONDS_PER_DAY);

    const firstRun = await fastify.dunningService.runDunningShard({
      ...SHARD_JOB,
      runAt: afterDue.toISOString(),
    });

    const secondRun = await fastify.dunningService.runDunningShard({
      ...SHARD_JOB,
      runAt: new Date(
        afterDue.getTime() + fastify.billingSchedules.dunningInFlightTimeoutMs + 1_000,
      ).toISOString(),
    });

    await fastify.paymentService.drainProviderEvents();

    const intents = await fastify.paymentIntentRepository.findPaymentIntents({ invoiceId });

    const charges = await fastify.paymentIntentRepository.findCharges({
      paymentIntentIds: _.map(intents, 'id'),
    });

    expect(firstRun.attempted).toBe(1);
    expect(secondRun.awaiting).toBe(1);
    expect(charges).toHaveLength(1);
  });

  it.each([
    { token: PspTokenEnum.CARD_DECLINED, scenario: 'a generic decline', expectedDelayDays: 1 },
    {
      token: PspTokenEnum.CARD_INSUFFICIENT_FUNDS,
      scenario: 'insufficient funds',
      expectedDelayDays: 3,
    },
    { token: PspTokenEnum.CARD_EXPIRED, scenario: 'an expired card', expectedDelayDays: 7 },
  ])(
    'waits $expectedDelayDays days before trying again after $scenario',
    async ({ token, expectedDelayDays }) => {
      const invoiceId = await makeOpenInvoice(token);
      const dueAt = await readDueAt(invoiceId);
      const failedAt = Date.now();

      await runShard(new Date(dueAt.getTime() + MILLISECONDS_PER_DAY));
      const retried = await readInvoiceRow(invoiceId);

      const { nextAttemptAt } = retried;

      const delayMs = (nextAttemptAt ? Date.parse(nextAttemptAt) : 0) - failedAt;

      expect(retried.status).toBe(InvoiceStatusEnum.OPEN);
      expect(retried.attemptCount).toBe(1);
      expect(delayMs).toBeGreaterThan(expectedDelayDays * MILLISECONDS_PER_DAY - CLOCK_SLACK_MS);
      expect(delayMs).toBeLessThan(expectedDelayDays * MILLISECONDS_PER_DAY + CLOCK_SLACK_MS);
    },
  );

  it.each([
    { token: PspTokenEnum.CARD_LOST, scenario: 'a lost card' },
    { token: PspTokenEnum.CARD_STOLEN, scenario: 'a stolen card' },
  ])('never retries $scenario and gives up on the first decline', async ({ token }) => {
    const invoiceId = await makeOpenInvoice(token);
    const dueAt = await readDueAt(invoiceId);

    await runShard(new Date(dueAt.getTime() + MILLISECONDS_PER_DAY));
    const abandoned = await readInvoiceRow(invoiceId);

    expect(abandoned.status).toBe(InvoiceStatusEnum.UNCOLLECTIBLE);
    expect(abandoned.attemptCount).toBe(1);
    expect(abandoned.nextAttemptAt).toBeNull();
  });

  it('reuses the open payment intent instead of minting a new one for every attempt', async () => {
    const invoiceId = await makeOpenInvoice(PspTokenEnum.CARD_DECLINED);
    const dueAt = await readDueAt(invoiceId);

    let runAt = new Date(dueAt.getTime() + MILLISECONDS_PER_DAY);

    for (const _attempt of _.range(3)) {
      await runShard(runAt);

      const { nextAttemptAt } = await readInvoiceRow(invoiceId);

      const retryAt = nextAttemptAt ? new Date(nextAttemptAt) : runAt;

      runAt = new Date(retryAt.getTime() + MILLISECONDS_PER_DAY);
    }

    const intents = await fastify.paymentIntentRepository.findPaymentIntents({ invoiceId });

    const charges = await fastify.paymentIntentRepository.findCharges({
      paymentIntentIds: _.map(intents, 'id'),
    });

    expect(intents).toHaveLength(1);
    expect(charges.length).toBeGreaterThanOrEqual(3);
  });

  it('gives up and marks the invoice uncollectible once the retry schedule runs out', async () => {
    const invoiceId = await makeOpenInvoice(PspTokenEnum.CARD_INSUFFICIENT_FUNDS);
    const dueAt = await readDueAt(invoiceId);
    const retryCount = DECLINE_TAXONOMY[DeclineCodeEnum.INSUFFICIENT_FUNDS].retryDelayDays.length;

    let runAt = new Date(dueAt.getTime() + MILLISECONDS_PER_DAY);

    for (const _attempt of _.range(retryCount + 1)) {
      await runShard(runAt);

      const { nextAttemptAt } = await readInvoiceRow(invoiceId);

      const retryAt = nextAttemptAt ? new Date(nextAttemptAt) : runAt;

      runAt = new Date(retryAt.getTime() + MILLISECONDS_PER_DAY);
    }

    const abandoned = await readInvoiceRow(invoiceId);

    expect(abandoned.status).toBe(InvoiceStatusEnum.UNCOLLECTIBLE);
    expect(abandoned.nextAttemptAt).toBeNull();
    expect(abandoned.attemptCount).toBe(retryCount + 1);
  });

  it('stops chasing an invoice it has already given up on', async () => {
    const invoiceId = await makeOpenInvoice(PspTokenEnum.CARD_LOST);
    const dueAt = await readDueAt(invoiceId);
    const afterDue = new Date(dueAt.getTime() + MILLISECONDS_PER_DAY);

    await runShard(afterDue);

    const afterAbandon = await fastify.dunningService.runDunningShard({
      ...SHARD_JOB,
      runAt: new Date(afterDue.getTime() + 30 * MILLISECONDS_PER_DAY).toISOString(),
    });

    expect(afterAbandon.scanned).toBe(0);
  });
});

describe('WebhookService.createWebhookEndpoint', () => {
  it('returns the signing secret once, at creation, and never again', async () => {
    const created = await fastify.webhookService.createWebhookEndpoint({
      module: ErpModuleEnum.BILLING,
      url: 'https://example.test/hooks',
      enabledEvents: [DomainEventTypeEnum.INVOICE_FINALIZED],
    });

    const fetched = await fastify.webhookService.getWebhookEndpoint(created.id);

    expect(created.secret).toMatch(/^whsec_[0-9a-f]{48}$/);
    expect(fetched.secret).toBeNull();
    expect(fetched.status).toBe(WebhookEndpointStatusEnum.ENABLED);
  });
});

describe('WebhookService.handleDomainEvent', () => {
  it('queues a delivery only for endpoints subscribed to that event', async () => {
    const eventId = generateGid(ObjectPrefixEnum.EVENT);

    const subscribed = await fastify.webhookService.createWebhookEndpoint({
      module: ErpModuleEnum.BILLING,
      url: 'https://example.test/subscribed',
      enabledEvents: [DomainEventTypeEnum.INVOICE_PAID],
    });

    await fastify.webhookService.createWebhookEndpoint({
      module: ErpModuleEnum.BILLING,
      url: 'https://example.test/uninterested',
      enabledEvents: [DomainEventTypeEnum.CUSTOMER_CREATED],
    });

    const queued = await fastify.webhookService.handleDomainEvent({
      eventId,
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
    const endpoint = await fastify.webhookService.createWebhookEndpoint({
      module: ErpModuleEnum.BILLING,
      url: 'https://example.test/disabled',
      enabledEvents: [DomainEventTypeEnum.INVOICE_VOIDED],
    });

    await fastify.webhookService.updateWebhookEndpoint(endpoint.id, {
      status: WebhookEndpointStatusEnum.DISABLED,
    });

    await fastify.webhookService.handleDomainEvent({
      eventId: generateGid(ObjectPrefixEnum.EVENT),
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
    const created = await fastify.webhookService.createWebhookEndpoint({
      module: ErpModuleEnum.BILLING,
      url: 'https://example.test/signed',
      enabledEvents: [DomainEventTypeEnum.INVOICE_FINALIZED],
    });

    await fastify.webhookService.handleDomainEvent({
      eventId: generateGid(ObjectPrefixEnum.EVENT),
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

    const created = await fastify.webhookService.createWebhookEndpoint({
      module: ErpModuleEnum.BILLING,
      url: 'https://example.test/idempotent',
      enabledEvents: [DomainEventTypeEnum.REFUND_CREATED],
    });

    await fastify.webhookService.handleDomainEvent({
      eventId,
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
      type: DomainEventTypeEnum.REFUND_CREATED,
    });
  });
});

describe('WebhookService.recordDeliveryResult', () => {
  it('keeps the failure reason on the delivery so a dead endpoint is visible', async () => {
    const created = await fastify.webhookService.createWebhookEndpoint({
      module: ErpModuleEnum.BILLING,
      url: 'https://example.test/broken',
      enabledEvents: [DomainEventTypeEnum.INVOICE_CREATED],
    });

    await fastify.webhookService.handleDomainEvent({
      eventId: generateGid(ObjectPrefixEnum.EVENT),
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

    expect(_.get(failed, 'status')).toBe(WebhookDeliveryStatusEnum.FAILED);
    expect(_.get(failed, 'attemptCount')).toBe(3);
    expect(_.get(failed, 'responseStatus')).toBe(500);
    expect(_.get(failed, 'deliveredAt')).toBeNull();
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
