import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import type { DomainEventDispatchJob } from '@pinstripe/core/queues';

export class DomainEventDispatchProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(job: Job<DomainEventDispatchJob>): Promise<void> {
    this.fastify.log.info(
      { eventId: job.data.eventId, eventType: job.data.eventType },
      '[DomainEventDispatchProcessor] handle() received domain event',
    );
  }
}
