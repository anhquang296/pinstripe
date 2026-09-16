import type { WebhookDeliveryJob } from '@pinstripe/core/queues';
import { WEBHOOK_QUEUE } from '@pinstripe/core/queues';
import { WebhookDeliveryProcessor } from '@workflows/processors/webhook-delivery.processor';
import type { Workflow } from '@workflows/workflow';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';

export class WebhookWorkflow implements Workflow {
  private readonly worker: Worker<WebhookDeliveryJob>;
  private readonly processor: WebhookDeliveryProcessor;

  constructor(fastify: FastifyInstance) {
    this.processor = new WebhookDeliveryProcessor(fastify);
    this.worker = new Worker<WebhookDeliveryJob>(
      WEBHOOK_QUEUE,
      async (job: Job<WebhookDeliveryJob>) => {
        await this.processor.handle(job);
      },
      { connection: fastify.workerConnection, prefix: fastify.queuePrefix },
    );
  }

  async destroy(): Promise<void> {
    await this.worker.close();
  }
}
