import type { NotificationSendJob } from '@pinstripe/core/queues';
import { NOTIFICATION_QUEUE } from '@pinstripe/core/queues';
import { NotificationSendProcessor } from '@workflows/processors/notification-send.processor';
import type { Workflow } from '@workflows/workflow';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';

export class NotificationWorkflow implements Workflow {
  private readonly worker: Worker<NotificationSendJob>;
  private readonly processor: NotificationSendProcessor;

  constructor(fastify: FastifyInstance) {
    this.processor = new NotificationSendProcessor(fastify);
    this.worker = new Worker<NotificationSendJob>(
      NOTIFICATION_QUEUE,
      async (job: Job<NotificationSendJob>) => {
        await this.processor.handle(job);
      },
      { connection: fastify.workerConnection, prefix: fastify.queuePrefix },
    );
  }

  async destroy(): Promise<void> {
    await this.worker.close();
  }
}
