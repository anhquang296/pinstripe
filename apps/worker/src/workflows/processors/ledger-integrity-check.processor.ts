import type { LedgerIntegrityCheckJob } from '@vxrerp/core/queues';
import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';

export class LedgerIntegrityCheckProcessor {
  constructor(private readonly fastify: FastifyInstance) {}

  async handle(job: Job<LedgerIntegrityCheckJob>): Promise<void> {
    const imbalanced = await this.fastify.ledgerService.findImbalancedTransactions(
      job.data.batchSize,
    );

    if (imbalanced.length === 0) {
      this.fastify.log.debug('[LedgerIntegrityCheckProcessor] handle() ledger is balanced');

      return;
    }

    this.fastify.log.error(
      { transactionIds: imbalanced },
      '[LedgerIntegrityCheckProcessor] handle() ledger postings do not sum to zero',
    );
  }
}
