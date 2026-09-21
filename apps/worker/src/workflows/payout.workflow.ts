import { PAYOUT_QUEUE, PAYOUT_SETTLE_POLL_JOB, QueueNameEnum } from '@vxrerp/core/queues';
import { PayoutSettlePollProcessor } from '@workflows/processors/payout-settle-poll.processor';
import type { Workflow } from '@workflows/workflow';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';

const PAYOUT_SETTLE_SCHEDULER_ID = 'payout-settle-poll-scheduler';

export class PayoutWorkflow implements Workflow {
  private readonly worker: Worker;
  private readonly processor: PayoutSettlePollProcessor;

  constructor(private readonly fastify: FastifyInstance) {
    this.processor = new PayoutSettlePollProcessor(fastify);
    this.worker = new Worker(
      PAYOUT_QUEUE,
      async () => {
        await this.processor.handle();
      },
      { connection: fastify.workerConnection, prefix: fastify.queuePrefix },
    );

    void this.dispatchSettleSchedule().catch((error: unknown) => {
      fastify.log.error({ error }, '[PayoutWorkflow] dispatchSettleSchedule() error');
    });
  }

  async destroy(): Promise<void> {
    await this.worker.close();
  }

  private async dispatchSettleSchedule(): Promise<void> {
    const { payoutSettlePollIntervalMs } = this.fastify.workflowSchedules;

    await this.fastify.queues
      .resolve(QueueNameEnum.PAYOUT)
      .upsertJobScheduler(
        PAYOUT_SETTLE_SCHEDULER_ID,
        { every: payoutSettlePollIntervalMs },
        { name: PAYOUT_SETTLE_POLL_JOB, data: {} },
      );
  }
}
