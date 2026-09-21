import { PAYMENT_QUEUE, PSP_CALLBACK_POLL_JOB } from '@vxrerp/billing/queues';
import { QueueNameEnum } from '@vxrerp/platform/queues';
import { PspCallbackPollProcessor } from '@workflows/processors/psp-callback-poll.processor';
import type { Workflow } from '@workflows/workflow';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';

const PSP_CALLBACK_SCHEDULER_ID = 'psp-callback-poll-scheduler';

export class PaymentWorkflow implements Workflow {
  private readonly worker: Worker;
  private readonly processor: PspCallbackPollProcessor;

  constructor(private readonly fastify: FastifyInstance) {
    this.processor = new PspCallbackPollProcessor(fastify);
    this.worker = new Worker(
      PAYMENT_QUEUE,
      async () => {
        await this.processor.handle();
      },
      { connection: fastify.workerConnection, prefix: fastify.queuePrefix },
    );

    void this.dispatchCallbackPollSchedule().catch((error: unknown) => {
      fastify.log.error({ error }, '[PaymentWorkflow] dispatchCallbackPollSchedule() error');
    });
  }

  async destroy(): Promise<void> {
    await this.worker.close();
  }

  private async dispatchCallbackPollSchedule(): Promise<void> {
    const { pspCallbackPollIntervalMs } = this.fastify.billingSchedules;

    await this.fastify.queues
      .resolve(QueueNameEnum.PAYMENT)
      .upsertJobScheduler(
        PSP_CALLBACK_SCHEDULER_ID,
        { every: pspCallbackPollIntervalMs },
        { name: PSP_CALLBACK_POLL_JOB, data: {} },
      );
  }
}
