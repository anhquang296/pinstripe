import type { OutboxRelayJob } from '@vxrerp/core/queues';
import {
  buildOutboxRelayJob,
  OUTBOX_QUEUE,
  OUTBOX_RELAY_JOB,
  QueueNameEnum,
} from '@vxrerp/core/queues';
import { OutboxRelayProcessor } from '@workflows/processors/outbox-relay.processor';
import type { Workflow } from '@workflows/workflow';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';

const RELAY_SCHEDULER_ID = 'outbox-relay-scheduler';

export class OutboxWorkflow implements Workflow {
  private readonly worker: Worker<OutboxRelayJob>;
  private readonly processor: OutboxRelayProcessor;

  constructor(private readonly fastify: FastifyInstance) {
    this.processor = new OutboxRelayProcessor(fastify);
    this.worker = new Worker<OutboxRelayJob>(
      OUTBOX_QUEUE,
      async (job: Job<OutboxRelayJob>) => {
        await this.processor.handle(job);
      },
      { connection: fastify.workerConnection, prefix: fastify.queuePrefix },
    );

    void this.dispatchRelaySchedule().catch((error: unknown) => {
      fastify.log.error({ error }, '[OutboxWorkflow] dispatchRelaySchedule() error');
    });
  }

  async destroy(): Promise<void> {
    await this.worker.close();
  }

  private async dispatchRelaySchedule(): Promise<void> {
    const { outboxRelayIntervalMs, outboxRelayBatchSize } = this.fastify.workflowSchedules;

    await this.fastify.queues
      .resolve(QueueNameEnum.OUTBOX)
      .upsertJobScheduler(
        RELAY_SCHEDULER_ID,
        { every: outboxRelayIntervalMs },
        { name: OUTBOX_RELAY_JOB, data: buildOutboxRelayJob(outboxRelayBatchSize) },
      );
  }
}
