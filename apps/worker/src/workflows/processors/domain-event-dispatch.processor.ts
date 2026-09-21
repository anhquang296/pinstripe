import type { DomainEventDispatchJob } from '@vxrerp/platform/queues';
import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';

export class DomainEventDispatchProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(job: Job<DomainEventDispatchJob>): Promise<void> {
    await this.fastify.domainEventDispatchService.handleDomainEvent(job.data);
  }
}
