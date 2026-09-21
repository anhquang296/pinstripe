import type { BillingRunShardJob } from '@vxrerp/billing/queues';
import {
  BILLING_QUEUE,
  BILLING_RUN_DISPATCH_JOB,
  BILLING_RUN_SHARD_JOB,
  buildBillingRunShardJob,
} from '@vxrerp/billing/queues';
import { QueueNameEnum } from '@vxrerp/platform/queues';
import { BillingRunShardProcessor } from '@workflows/processors/billing-run-shard.processor';
import type { Workflow } from '@workflows/workflow';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const BILLING_SCHEDULER_ID = 'billing-run-scheduler';

export class BillingWorkflow implements Workflow {
  private readonly worker: Worker<BillingRunShardJob>;
  private readonly processor: BillingRunShardProcessor;

  constructor(private readonly fastify: FastifyInstance) {
    this.processor = new BillingRunShardProcessor(fastify);
    this.worker = new Worker<BillingRunShardJob>(
      BILLING_QUEUE,
      async (job: Job<BillingRunShardJob>) => {
        if (job.name === BILLING_RUN_DISPATCH_JOB) {
          await this.dispatchShards();

          return;
        }

        await this.processor.handle(job);
      },
      { connection: fastify.workerConnection, prefix: fastify.queuePrefix },
    );

    void this.dispatchBillingSchedule().catch((error: unknown) => {
      fastify.log.error({ error }, '[BillingWorkflow] dispatchBillingSchedule() error');
    });
  }

  async destroy(): Promise<void> {
    await this.worker.close();
  }

  private async dispatchBillingSchedule(): Promise<void> {
    const { billingRunIntervalMs } = this.fastify.billingSchedules;

    await this.fastify.queues
      .resolve(QueueNameEnum.BILLING)
      .upsertJobScheduler(
        BILLING_SCHEDULER_ID,
        { every: billingRunIntervalMs },
        { name: BILLING_RUN_DISPATCH_JOB, data: {} },
      );
  }

  private async dispatchShards(): Promise<void> {
    const { billingRunShardCount, billingRunJitterMs } = this.fastify.billingSchedules;

    const runAt = this.fastify.clock.now();
    const queue = this.fastify.queues.resolve(QueueNameEnum.BILLING);

    await Promise.all(
      _.map(_.range(billingRunShardCount), (shardIndex) => {
        return queue.add(
          BILLING_RUN_SHARD_JOB,
          buildBillingRunShardJob(shardIndex, billingRunShardCount, runAt),
          {
            jobId: `billing-run-${shardIndex}-${runAt.getTime()}`,
            delay: _.random(0, billingRunJitterMs),
            removeOnComplete: true,
          },
        );
      }),
    );

    this.fastify.log.info(
      { shardCount: billingRunShardCount },
      '[BillingWorkflow] dispatchShards() completed',
    );
  }
}
