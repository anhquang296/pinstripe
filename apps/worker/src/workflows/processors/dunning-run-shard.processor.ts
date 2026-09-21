import type { DunningRunShardJob } from '@vxrerp/billing/queues';
import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';

export class DunningRunShardProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(job: Job<DunningRunShardJob>): Promise<void> {
    const dunningRun = await this.fastify.dunningService.runDunningShard(job.data);

    this.fastify.log.info(
      { shardIndex: job.data.shardIndex, ...dunningRun },
      '[DunningRunShardProcessor] handle() completed',
    );
  }
}
