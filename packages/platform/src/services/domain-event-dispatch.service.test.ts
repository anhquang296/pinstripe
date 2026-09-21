import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import { ConflictError } from '@errors/app.error';
import type { DomainEventDispatchJob } from '@queues/domain-event.queue';
import { DomainEventDispatchService } from '@services/domain-event-dispatch.service';
import type { FastifyInstance } from 'fastify';
import { expect, it, vi } from 'vitest';

function makeDomainEvent(overrides: Partial<DomainEventDispatchJob> = {}): DomainEventDispatchJob {
  return {
    eventId: 'evt_default',
    eventType: DomainEventTypeEnum.SUBSCRIPTION_CREATED,
    aggregateType: AggregateTypeEnum.SUBSCRIPTION,
    aggregateId: 'sub_default',
    payload: {},
    occurredAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function setup() {
  const handleWebhookEvent = vi.fn().mockResolvedValue(0);

  const fastify = {
    webhookService: { handleDomainEvent: handleWebhookEvent },
    log: { info: vi.fn(), debug: vi.fn() },
  } as unknown as FastifyInstance;

  return {
    domainEventDispatchService: new DomainEventDispatchService(fastify),
    handleWebhookEvent,
  };
}

it('runs a handler registered for the aggregate type of the event', async () => {
  const { domainEventDispatchService } = setup();

  const handle = vi.fn().mockResolvedValue(undefined);
  const event = makeDomainEvent({ aggregateId: 'sub_123' });

  domainEventDispatchService.registerDomainEventHandler({
    name: 'billing.entitlement-sync',
    aggregateTypes: [AggregateTypeEnum.SUBSCRIPTION],
    handle,
  });

  await domainEventDispatchService.handleDomainEvent(event);

  expect(handle).toHaveBeenCalledWith(event);
});

it('skips a handler registered for a different aggregate type', async () => {
  const { domainEventDispatchService } = setup();

  const handle = vi.fn().mockResolvedValue(undefined);

  domainEventDispatchService.registerDomainEventHandler({
    name: 'billing.entitlement-sync',
    aggregateTypes: [AggregateTypeEnum.SUBSCRIPTION],
    handle,
  });

  await domainEventDispatchService.handleDomainEvent(
    makeDomainEvent({ aggregateType: AggregateTypeEnum.INVOICE }),
  );

  expect(handle).not.toHaveBeenCalled();
});

it('fans the event out to webhooks even when no module handler matches', async () => {
  const { domainEventDispatchService, handleWebhookEvent } = setup();

  const event = makeDomainEvent({ aggregateType: AggregateTypeEnum.INVOICE });

  await domainEventDispatchService.handleDomainEvent(event);

  expect(handleWebhookEvent).toHaveBeenCalledWith(event);
});

it('throws ConflictError when a handler name is registered twice', () => {
  const { domainEventDispatchService } = setup();

  const handler = {
    name: 'billing.entitlement-sync',
    aggregateTypes: [AggregateTypeEnum.SUBSCRIPTION],
    handle: vi.fn(),
  };

  domainEventDispatchService.registerDomainEventHandler(handler);

  expect(() => {
    domainEventDispatchService.registerDomainEventHandler(handler);
  }).toThrow(ConflictError);
});
