import type { NotificationSendJob } from '@vxrerp/billing/queues';
import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';

export class NotificationSendProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(job: Job<NotificationSendJob>): Promise<void> {
    const outcome = await this.fastify.notificationService.sendNotification(job.data);

    this.fastify.log.info(
      { kind: job.data.kind, outcome },
      '[NotificationSendProcessor] handle() completed',
    );
  }
}
