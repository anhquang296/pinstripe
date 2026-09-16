import type { DatabaseTransaction } from '@database/database.client';
import type { NewOutboxEvent } from '@database/schemas';
import type { DomainEventDispatchJob } from '@queues/domain-event.queue';
import { buildDomainEventDispatchJob, DOMAIN_EVENT_DISPATCH_JOB } from '@queues/domain-event.queue';
import { QueueNameEnum } from '@queues/queue-name';
import type { ClaimedOutboxEvent } from '@repositories/outbox-event.repository';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

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
  ): Promise<string[]> {
    const occurredAt = this.fastify.clock.now();
    const outboxRows: NewOutboxEvent[] = _.map(events, (event) => {
      return {
        id: generateGid(ObjectPrefixEnum.EVENT),
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
        occurredAt,
      };
    });

    await this.fastify.outboxEventRepository.createOutboxEvents(outboxRows, executor);

    return _.map(outboxRows, 'id');
  }

  async relayOutboxEvents(batchSize: number): Promise<number> {
    const claimedEvents = await this.fastify.outboxEventRepository.claimOutboxEvents(batchSize);

    if (_.isEmpty(claimedEvents)) {
      return 0;
    }

    const published: string[] = [];

    for (const event of claimedEvents) {
      try {
        await this.dispatchDomainEvent(event);
        published.push(event.id);
      } catch (error) {
        this.fastify.log.error(
          { error, eventId: event.id },
          '[OutboxService] relayOutboxEvents() error',
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

  private async dispatchDomainEvent(
    event: ClaimedOutboxEvent,
  ): Promise<Job<DomainEventDispatchJob>> {
    const job = buildDomainEventDispatchJob({
      eventId: event.id,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      occurredAt: event.occurredAt,
    });

    return this.fastify.queues
      .resolve(QueueNameEnum.DOMAIN_EVENT)
      .add(DOMAIN_EVENT_DISPATCH_JOB, job, { jobId: event.id });
  }
}
