import { AggregateTypeEnum } from '@vxrerp/core/contracts';
import type { DomainEventDispatchJob } from '@vxrerp/core/queues';
import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';

export class DomainEventDispatchProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(job: Job<DomainEventDispatchJob>): Promise<void> {
    const { eventId, eventType, aggregateType, aggregateId } = job.data;

    const deliveries = await this.fastify.webhookService.handleDomainEvent(job.data);

    if (deliveries > 0) {
      this.fastify.log.info(
        { eventId, eventType, deliveries },
        '[DomainEventDispatchProcessor] handle() queued webhook deliveries',
      );
    }

    if (aggregateType === AggregateTypeEnum.SUBSCRIPTION) {
      await this.fastify.entitlementService.handleSubscriptionChanged(aggregateId);

      this.fastify.log.info(
        { eventId, eventType, subscriptionId: aggregateId },
        '[DomainEventDispatchProcessor] handle() synced entitlements from subscription event',
      );

      return;
    }

    this.fastify.log.debug(
      { eventId, eventType },
      '[DomainEventDispatchProcessor] handle() no consumer for this event yet',
    );
  }
}
