import { CHECKOUT_EXPIRE_POLL_JOB, CHECKOUT_QUEUE } from '@vxrerp/billing/queues';
import { QueueNameEnum } from '@vxrerp/platform/queues';
import { CheckoutExpirePollProcessor } from '@workflows/processors/checkout-expire-poll.processor';
import type { Workflow } from '@workflows/workflow';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';

const CHECKOUT_EXPIRE_SCHEDULER_ID = 'checkout-expire-poll-scheduler';

export class CheckoutWorkflow implements Workflow {
  private readonly worker: Worker;
  private readonly processor: CheckoutExpirePollProcessor;

  constructor(private readonly fastify: FastifyInstance) {
    this.processor = new CheckoutExpirePollProcessor(fastify);
    this.worker = new Worker(
      CHECKOUT_QUEUE,
      async () => {
        await this.processor.handle();
      },
      { connection: fastify.workerConnection, prefix: fastify.queuePrefix },
    );

    void this.dispatchExpireSchedule().catch((error: unknown) => {
      fastify.log.error({ error }, '[CheckoutWorkflow] dispatchExpireSchedule() error');
    });
  }

  async destroy(): Promise<void> {
    await this.worker.close();
  }

  private async dispatchExpireSchedule(): Promise<void> {
    const { checkoutExpirePollIntervalMs } = this.fastify.billingSchedules;

    await this.fastify.queues
      .resolve(QueueNameEnum.CHECKOUT)
      .upsertJobScheduler(
        CHECKOUT_EXPIRE_SCHEDULER_ID,
        { every: checkoutExpirePollIntervalMs },
        { name: CHECKOUT_EXPIRE_POLL_JOB, data: {} },
      );
  }
}
