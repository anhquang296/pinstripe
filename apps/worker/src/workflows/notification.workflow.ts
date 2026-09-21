import type { InvoiceReminderRunJob, NotificationSendJob } from '@vxrerp/billing/queues';
import { INVOICE_REMINDER_RUN_JOB, NOTIFICATION_QUEUE } from '@vxrerp/billing/queues';
import { QueueNameEnum } from '@vxrerp/platform/queues';
import { InvoiceReminderRunProcessor } from '@workflows/processors/invoice-reminder-run.processor';
import { NotificationSendProcessor } from '@workflows/processors/notification-send.processor';
import type { Workflow } from '@workflows/workflow';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';

const INVOICE_REMINDER_SCHEDULER_ID = 'invoice-reminder-scheduler';

type NotificationQueueJob = NotificationSendJob | InvoiceReminderRunJob;

export class NotificationWorkflow implements Workflow {
  private readonly worker: Worker<NotificationQueueJob>;
  private readonly processor: NotificationSendProcessor;
  private readonly invoiceReminderProcessor: InvoiceReminderRunProcessor;

  constructor(private readonly fastify: FastifyInstance) {
    this.processor = new NotificationSendProcessor(fastify);
    this.invoiceReminderProcessor = new InvoiceReminderRunProcessor(fastify);
    this.worker = new Worker<NotificationQueueJob>(
      NOTIFICATION_QUEUE,
      async (job: Job<NotificationQueueJob>) => {
        if (job.name === INVOICE_REMINDER_RUN_JOB) {
          await this.invoiceReminderProcessor.handle();

          return;
        }

        await this.processor.handle(job as Job<NotificationSendJob>);
      },
      { connection: fastify.workerConnection, prefix: fastify.queuePrefix },
    );

    void this.dispatchInvoiceReminderSchedule().catch((error: unknown) => {
      fastify.log.error(
        { error },
        '[NotificationWorkflow] dispatchInvoiceReminderSchedule() error',
      );
    });
  }

  async destroy(): Promise<void> {
    await this.worker.close();
  }

  private async dispatchInvoiceReminderSchedule(): Promise<void> {
    const { invoiceReminderIntervalMs } = this.fastify.billingSchedules;

    await this.fastify.queues
      .resolve(QueueNameEnum.NOTIFICATION)
      .upsertJobScheduler(
        INVOICE_REMINDER_SCHEDULER_ID,
        { every: invoiceReminderIntervalMs },
        { name: INVOICE_REMINDER_RUN_JOB, data: {} },
      );
  }
}
