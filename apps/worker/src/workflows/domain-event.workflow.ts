import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { DOMAIN_EVENT_QUEUE } from '@pinstripe/core/queues';
import type { DomainEventDispatchJob } from '@pinstripe/core/queues';
import { DomainEventDispatchProcessor } from '@workflows/processors/domain-event-dispatch.processor';
import type { Workflow } from '@workflows/workflow';

export class DomainEventWorkflow implements Workflow {
  private readonly worker: Worker<DomainEventDispatchJob>;
  private readonly connection: Redis;
  private readonly processor: DomainEventDispatchProcessor;

  constructor(fastify: FastifyInstance) {
    const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_KEY_PREFIX } = fastify.config;

    this.processor = new DomainEventDispatchProcessor(fastify);
    this.connection = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });
    this.worker = new Worker<DomainEventDispatchJob>(
      DOMAIN_EVENT_QUEUE,
      async (job: Job<DomainEventDispatchJob>) => {
        await this.processor.handle(job);
      },
      { connection: this.connection, prefix: `${REDIS_KEY_PREFIX}:bull` },
    );
  }

  async destroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }
}
