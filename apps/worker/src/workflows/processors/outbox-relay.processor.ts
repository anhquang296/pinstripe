import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import type { OutboxRelayJob } from '@pinstripe/core/queues';

export class OutboxRelayProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(job: Job<OutboxRelayJob>): Promise<void> {
    const relayed = await this.fastify.outboxService.relayOutboxEvents(job.data.batchSize);

    if (relayed > 0) {
      this.fastify.log.info(
        { relayed },
        '[OutboxRelayProcessor] handle() relayed outbox events to the domain event queue',
      );
    }
  }
}
