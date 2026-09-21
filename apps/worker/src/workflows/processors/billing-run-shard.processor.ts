import type { BillingRunShardJob } from '@vxrerp/billing/queues';
import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';

export class BillingRunShardProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(job: Job<BillingRunShardJob>): Promise<void> {
    const billingRun = await this.fastify.billingRunService.runBillingShard(job.data);

    this.fastify.log.info(
      { shardIndex: job.data.shardIndex, ...billingRun },
      '[BillingRunShardProcessor] handle() completed',
    );
  }
}
