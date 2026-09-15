import type { DomainEventDispatchJob } from '@pinstripe/core/queues';
import { DOMAIN_EVENT_QUEUE } from '@pinstripe/core/queues';
import { DomainEventDispatchProcessor } from '@workflows/processors/domain-event-dispatch.processor';
import type { Workflow } from '@workflows/workflow';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';

export class DomainEventWorkflow implements Workflow {
  private readonly worker: Worker<DomainEventDispatchJob>;
  private readonly processor: DomainEventDispatchProcessor;

  constructor(fastify: FastifyInstance) {
    this.processor = new DomainEventDispatchProcessor(fastify);
    this.worker = new Worker<DomainEventDispatchJob>(
      DOMAIN_EVENT_QUEUE,
      async (job: Job<DomainEventDispatchJob>) => {
        await this.processor.handle(job);
      },
      { connection: fastify.workerConnection, prefix: fastify.queuePrefix },
    );
  }

  async destroy(): Promise<void> {
    await this.worker.close();
  }
}
