import { SubscriptionStatusEnum } from '@contracts/subscriptions.types';
import type { BillingRunShardJob } from '@queues/billing.queue';
import type { FastifyInstance } from 'fastify';

const BILLABLE_STATUSES = [SubscriptionStatusEnum.ACTIVE, SubscriptionStatusEnum.PAST_DUE] as const;

export interface BillingRunOptions {
  batchSize: number;
}

export interface BillingRunResult {
  drafted: number;
  scanned: number;
}

export class BillingRunService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly options: BillingRunOptions,
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
      this.options.batchSize,
    );

    let drafted = 0;

    for (const subscription of due) {
      const { isCreated } = await this.fastify.invoiceService.ensureDraftInvoice(subscription, {});

      if (isCreated) {
        drafted += 1;
      }
    }

    this.fastify.log.info(
      { shardIndex: job.shardIndex, scanned: due.length, drafted },
      '[BillingRunService] runBillingShard() completed',
    );

    return { drafted, scanned: due.length };
  }
}
