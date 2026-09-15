import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import {
  buildOutboxRelayJob,
  OUTBOX_QUEUE,
  OUTBOX_RELAY_JOB,
  QueueNameEnum,
} from '@pinstripe/core/queues';
import type { OutboxRelayJob } from '@pinstripe/core/queues';
import { OutboxRelayProcessor } from '@workflows/processors/outbox-relay.processor';
import type { Workflow } from '@workflows/workflow';

const RELAY_SCHEDULER_ID = 'outbox-relay-scheduler';

export class OutboxWorkflow implements Workflow {
  private readonly worker: Worker<OutboxRelayJob>;
  private readonly connection: Redis;
  private readonly processor: OutboxRelayProcessor;

  constructor(private readonly fastify: FastifyInstance) {
    const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_KEY_PREFIX } = fastify.config;

    this.processor = new OutboxRelayProcessor(fastify);
    this.connection = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });
    this.worker = new Worker<OutboxRelayJob>(
      OUTBOX_QUEUE,
      async (job: Job<OutboxRelayJob>) => {
        await this.processor.handle(job);
      },
      { connection: this.connection, prefix: `${REDIS_KEY_PREFIX}:bull` },
    );

    void this.scheduleRelay();
  }

  async destroy(): Promise<void> {
    await this.worker.close();
    await this.connection.quit();
  }

  private async scheduleRelay(): Promise<void> {
    const { OUTBOX_RELAY_INTERVAL_MS, OUTBOX_RELAY_BATCH_SIZE } = this.fastify.config;

    await this.fastify.queues
      .resolve(QueueNameEnum.OUTBOX)
      .upsertJobScheduler(
        RELAY_SCHEDULER_ID,
        { every: OUTBOX_RELAY_INTERVAL_MS },
        { name: OUTBOX_RELAY_JOB, data: buildOutboxRelayJob(OUTBOX_RELAY_BATCH_SIZE) },
      );
  }
}
