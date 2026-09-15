import type { FastifyInstance } from 'fastify';
import type { DatabaseTransaction } from '@database/database.client';
import type { NewOutboxEvent } from '@database/schemas';
import { buildDomainEventDispatchJob, DOMAIN_EVENT_DISPATCH_JOB } from '@queues/domain-event.queue';
import { QueueNameEnum } from '@queues/queue-name';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';

export interface RecordEventPayload {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export class OutboxService {
  constructor(private readonly fastify: FastifyInstance) {}

  async recordEvents(
    events: readonly RecordEventPayload[],
    executor?: DatabaseTransaction,
  ): Promise<void> {
    const occurredAt = this.fastify.clock.now();
    const rows: NewOutboxEvent[] = events.map((event) => ({
      id: generateId(ObjectPrefixEnum.EVENT),
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      occurredAt,
    }));

    await this.fastify.outboxEventRepository.createOutboxEvents(rows, executor);
  }

  async relayOutboxEvents(batchSize: number): Promise<number> {
    const claimed = await this.fastify.outboxEventRepository.claimOutboxEvents(batchSize);

    if (claimed.length === 0) {
      return 0;
    }

    const queue = this.fastify.queues.resolve(QueueNameEnum.DOMAIN_EVENT);
    const published: string[] = [];

    for (const event of claimed) {
      try {
        const job = buildDomainEventDispatchJob({
          eventId: event.id,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          eventType: event.eventType,
          payload: event.payload,
          occurredAt: event.occurredAt,
        });

        await queue.add(DOMAIN_EVENT_DISPATCH_JOB, job, { jobId: event.id });
        published.push(event.id);
      } catch (error) {
        this.fastify.log.error(
          { err: error, eventId: event.id },
          '[OutboxService] relayOutboxEvents() failed to dispatch event',
        );

        await this.fastify.outboxEventRepository.failOutboxEvent(
          event.id,
          event.attemptCount + 1,
          String(error),
        );
      }
    }

    await this.fastify.outboxEventRepository.publishOutboxEvents(
      published,
      this.fastify.clock.now(),
    );

    return published.length;
  }
}
