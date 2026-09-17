import { SubscriptionStatusEnum } from '@contracts/subscriptions.types';
import type { BillingRunShardJob } from '@queues/billing.queue';
import type { FastifyInstance } from 'fastify';

const BILLABLE_STATUSES = [SubscriptionStatusEnum.ACTIVE, SubscriptionStatusEnum.PAST_DUE] as const;

export interface BillingRunServiceConfig {
  batchSize: number;
  finalizeDelayMs: number;
}

export interface BillingRunResult {
  drafted: number;
  scanned: number;
  finalized: number;
}

export class BillingRunService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly config: BillingRunServiceConfig,
  ) {}

  async runBillingShard(job: BillingRunShardJob): Promise<BillingRunResult> {
    const runAt = new Date(job.runAt);
    const due = await this.fastify.subscriptionRepository.findSubscriptions(
      {
        statuses: BILLABLE_STATUSES,
        currentPeriodEndTo: runAt,
        shardCount: job.shardCount,
        shardIndex: job.shardIndex,
      },
      this.config.batchSize,
    );

    let drafted = 0;

    for (const subscription of due) {
      const { isCreated } = await this.fastify.invoiceService.ensureDraftInvoice(subscription, {});

      if (isCreated) {
        drafted += 1;
      }
    }

    const finalizeBeforeAt = new Date(runAt.getTime() - this.config.finalizeDelayMs);
    const finalized = await this.fastify.invoiceService.advanceDraftInvoices(
      finalizeBeforeAt,
      job.shardCount,
      job.shardIndex,
      this.config.batchSize,
    );

    this.fastify.log.info(
      { shardIndex: job.shardIndex, scanned: due.length, drafted, finalized },
      '[BillingRunService] runBillingShard() completed',
    );

    return { drafted, scanned: due.length, finalized };
  }
}
