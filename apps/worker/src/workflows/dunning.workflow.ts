import type { DunningRunShardJob } from '@pinstripe/core/queues';
import {
  buildDunningRunShardJob,
  DUNNING_QUEUE,
  DUNNING_RUN_SHARD_JOB,
  QueueNameEnum,
} from '@pinstripe/core/queues';
import { DunningRunShardProcessor } from '@workflows/processors/dunning-run-shard.processor';
import type { Workflow } from '@workflows/workflow';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const DUNNING_SCHEDULER_ID = 'dunning-run-scheduler';
const DUNNING_DISPATCH_JOB = 'DunningRunDispatch';

export class DunningWorkflow implements Workflow {
  private readonly worker: Worker<DunningRunShardJob>;
  private readonly processor: DunningRunShardProcessor;

  constructor(private readonly fastify: FastifyInstance) {
    this.processor = new DunningRunShardProcessor(fastify);
    this.worker = new Worker<DunningRunShardJob>(
      DUNNING_QUEUE,
      async (job: Job<DunningRunShardJob>) => {
        if (job.name === DUNNING_DISPATCH_JOB) {
          await this.dispatchShards();

          return;
        }

        await this.processor.handle(job);
      },
      { connection: fastify.workerConnection, prefix: fastify.queuePrefix },
    );

    void this.dispatchDunningSchedule().catch((error: unknown) => {
      fastify.log.error({ error }, '[DunningWorkflow] dispatchDunningSchedule() error');
    });
  }

  async destroy(): Promise<void> {
    await this.worker.close();
  }

  private async dispatchDunningSchedule(): Promise<void> {
    const { dunningIntervalMs } = this.fastify.workflowSchedules;

    await this.fastify.queues
      .resolve(QueueNameEnum.DUNNING)
      .upsertJobScheduler(
        DUNNING_SCHEDULER_ID,
        { every: dunningIntervalMs },
        { name: DUNNING_DISPATCH_JOB, data: {} },
      );
  }

  private async dispatchShards(): Promise<void> {
    const { billingRunShardCount, dunningJitterMs } = this.fastify.workflowSchedules;
    const runAt = this.fastify.clock.now();
    const queue = this.fastify.queues.resolve(QueueNameEnum.DUNNING);

    await Promise.all(
      _.map(_.range(billingRunShardCount), (shardIndex) => {
        return queue.add(
          DUNNING_RUN_SHARD_JOB,
          buildDunningRunShardJob(shardIndex, billingRunShardCount, runAt),
          {
            jobId: `dunning-run-${shardIndex}-${runAt.getTime()}`,
            delay: _.random(0, dunningJitterMs),
            removeOnComplete: true,
          },
        );
      }),
    );
  }
}
