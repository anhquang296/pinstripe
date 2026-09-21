import { BILLABLE_SUBSCRIPTION_STATUSES, BillingModeEnum } from '@contracts/subscriptions.types';
import type { Subscription } from '@database/schemas';
import type { BillingRunShardJob } from '@queues/billing.queue';
import type { FastifyInstance } from 'fastify';

export interface BillingRunServiceConfig {
  batchSize: number;
  finalizeDelayMs: number;
}

export interface BillingRunResult {
  advanced: number;
  canceled: number;
  resumed: number;
  expired: number;
  drafted: number;
  scanned: number;
  finalized: number;
  attempted: number;
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
        statuses: BILLABLE_SUBSCRIPTION_STATUSES,
        currentPeriodEndTo: job.runAt,
        testClockIdIsNull: true,
        shardCount: job.shardCount,
        shardIndex: job.shardIndex,
      },
      this.config.batchSize,
    );

    let drafted = 0;

    for (const subscription of due) {
      const isDrafted = await this.draftInvoice(subscription);

      if (isDrafted) {
        drafted += 1;
      }
    }

    const lifecycle = await this.fastify.subscriptionService.runSubscriptionLifecycle(
      { testClockIdIsNull: true, shardCount: job.shardCount, shardIndex: job.shardIndex },
      runAt,
    );

    const finalizeBeforeAt = new Date(runAt.getTime() - this.config.finalizeDelayMs);

    const finalized = await this.fastify.invoiceService.advanceDraftInvoices(
      finalizeBeforeAt,
      job.shardCount,
      job.shardIndex,
      this.config.batchSize,
    );

    const dunningRun = await this.fastify.dunningService.runDunningShard(job);

    const billingRun: BillingRunResult = {
      ...lifecycle,
      drafted,
      scanned: due.length,
      finalized,
      attempted: dunningRun.attempted,
    };

    this.fastify.log.info(
      { shardIndex: job.shardIndex, ...billingRun },
      '[BillingRunService] runBillingShard() completed',
    );

    return billingRun;
  }

  private async draftInvoice(subscription: Subscription): Promise<boolean> {
    if (subscription.billingMode === BillingModeEnum.ADVANCE) {
      return false;
    }

    const { isCreated } = await this.fastify.invoiceService.ensureBillableDraft(subscription);

    return isCreated;
  }
}
