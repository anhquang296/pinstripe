import { MILLISECONDS_PER_DAY } from '@constants/time';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { PaymentIntentStatusEnum } from '@contracts/payments.types';
import type { Invoice } from '@database/schemas';
import type { DunningRunShardJob } from '@queues/dunning.queue';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const REUSABLE_INTENT_STATUSES = [
  PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
  PaymentIntentStatusEnum.REQUIRES_CONFIRMATION,
] as const;

export enum DunningOutcomeEnum {
  COLLECTED = 'collected',
  RETRIED = 'retried',
  ABANDONED = 'abandoned',
  SETTLED = 'settled',
}

export type DunningOutcome = `${DunningOutcomeEnum}`;

export interface DunningServiceConfig {
  batchSize: number;
  retryDelayDays: readonly number[];
}

export type DunningRunResult = Record<DunningOutcome, number> & {
  scanned: number;
  failed: number;
};

export class DunningService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly config: DunningServiceConfig,
  ) {}

  async runDunningShard(job: DunningRunShardJob): Promise<DunningRunResult> {
    const runAt = new Date(job.runAt);
    const due = await this.fastify.invoiceRepository.findInvoices(
      {
        status: InvoiceStatusEnum.OPEN,
        nextAttemptBeforeAt: runAt,
        shardCount: job.shardCount,
        shardIndex: job.shardIndex,
      },
      this.config.batchSize,
    );

    const dunningRun: DunningRunResult = {
      scanned: due.length,
      [DunningOutcomeEnum.COLLECTED]: 0,
      [DunningOutcomeEnum.RETRIED]: 0,
      [DunningOutcomeEnum.ABANDONED]: 0,
      [DunningOutcomeEnum.SETTLED]: 0,
      failed: 0,
    };

    for (const invoice of due) {
      try {
        const outcome = await this.collectInvoice(invoice, runAt);

        dunningRun[outcome] += 1;
      } catch (error) {
        dunningRun.failed += 1;

        this.fastify.log.error(
          { error, invoiceId: invoice.id },
          '[DunningService] runDunningShard() error',
        );
      }
    }

    this.fastify.log.info(
      { shardIndex: job.shardIndex, ...dunningRun },
      '[DunningService] runDunningShard() completed',
    );

    return dunningRun;
  }

  private async collectInvoice(invoice: Invoice, runAt: Date): Promise<DunningOutcome> {
    const now = await this.resolveDunningNow(invoice, runAt);
    const owed = await this.fastify.invoiceService.getInvoice(invoice.id, invoice.livemode);

    if (owed.amountRemaining <= 0) {
      await this.fastify.invoiceRepository.updateInvoice(invoice.id, {
        nextAttemptAt: null,
        updatedAt: now,
      });

      return DunningOutcomeEnum.SETTLED;
    }

    const paymentMethod = await this.resolvePaymentMethod(invoice);

    if (!paymentMethod) {
      this.fastify.log.warn(
        { invoiceId: invoice.id, customerId: invoice.customerId },
        '[DunningService] collectInvoice() no default payment method to charge',
      );

      return this.failAttempt(invoice, now, null);
    }

    const paymentIntentId = await this.resolveCollectionIntentId(invoice, paymentMethod);
    const confirmed = await this.fastify.paymentService.confirmPaymentIntent(
      paymentIntentId,
      { paymentMethod },
      invoice.livemode,
    );

    if (confirmed.status === PaymentIntentStatusEnum.SUCCEEDED) {
      await this.fastify.invoiceRepository.updateInvoice(invoice.id, {
        nextAttemptAt: null,
        updatedAt: now,
      });

      await this.settleSubscription(invoice, now);

      return DunningOutcomeEnum.COLLECTED;
    }

    return this.failAttempt(invoice, now, confirmed.failureCode);
  }

  private async failAttempt(
    invoice: Invoice,
    now: Date,
    failureCode: string | null,
  ): Promise<DunningOutcome> {
    const attemptCount = invoice.attemptCount + 1;
    const nextDelayDays = this.config.retryDelayDays[attemptCount];

    if (_.isNil(nextDelayDays)) {
      await this.abandonInvoice(invoice, now, attemptCount);
      await this.markSubscriptionFailed(invoice, now, true);

      return DunningOutcomeEnum.ABANDONED;
    }

    await this.fastify.invoiceRepository.updateInvoice(invoice.id, {
      attemptCount,
      nextAttemptAt: new Date(now.getTime() + nextDelayDays * MILLISECONDS_PER_DAY),
      updatedAt: now,
    });

    await this.markSubscriptionFailed(invoice, now, false);

    this.fastify.log.info(
      { invoiceId: invoice.id, attemptCount, failureCode },
      '[DunningService] failAttempt() scheduled another attempt',
    );

    return DunningOutcomeEnum.RETRIED;
  }

  private async resolveDunningNow(invoice: Invoice, runAt: Date): Promise<Date> {
    const invoiceNow = await this.fastify.clockService.resolveInvoiceNow(invoice);

    if (invoiceNow.getTime() > runAt.getTime()) {
      return invoiceNow;
    }

    return runAt;
  }

  private async settleSubscription(invoice: Invoice, now: Date): Promise<void> {
    const { subscriptionId } = invoice;

    if (subscriptionId) {
      await this.fastify.subscriptionService.handleInvoicePaymentSucceeded(
        subscriptionId,
        now,
        invoice.periodEnd,
      );
    }
  }

  private async markSubscriptionFailed(
    invoice: Invoice,
    now: Date,
    isFinalAttempt: boolean,
  ): Promise<void> {
    const { subscriptionId } = invoice;

    if (subscriptionId) {
      await this.fastify.subscriptionService.handleInvoicePaymentFailed(
        subscriptionId,
        now,
        isFinalAttempt,
      );
    }
  }

  private async resolveCollectionIntentId(
    invoice: Invoice,
    paymentMethod: string,
  ): Promise<string> {
    const [reusableIntent] = await this.fastify.paymentIntentRepository.findPaymentIntents(
      { invoiceId: invoice.id, statuses: REUSABLE_INTENT_STATUSES },
      1,
    );

    if (reusableIntent) {
      return reusableIntent.id;
    }

    const createdIntent = await this.fastify.paymentService.createPaymentIntent(
      { invoiceId: invoice.id, paymentMethod },
      invoice.livemode,
    );

    return createdIntent.id;
  }

  private async resolvePaymentMethod(invoice: Invoice): Promise<string | null> {
    const { subscriptionId } = invoice;

    if (subscriptionId) {
      const subscription =
        await this.fastify.subscriptionRepository.findSubscription(subscriptionId);
      const subscriptionPaymentMethod = _.get(subscription, 'defaultPaymentMethod', null);

      if (subscriptionPaymentMethod) {
        return subscriptionPaymentMethod;
      }
    }

    const customer = await this.fastify.customerRepository.findCustomer(invoice.customerId);

    return _.get(customer, 'defaultPaymentMethod', null);
  }

  private async abandonInvoice(invoice: Invoice, now: Date, attemptCount: number): Promise<void> {
    await this.fastify.database.master.transaction(async (tx) => {
      const abandoned = await this.fastify.invoiceRepository.updateInvoice(
        invoice.id,
        {
          status: InvoiceStatusEnum.UNCOLLECTIBLE,
          attemptCount,
          nextAttemptAt: null,
          updatedAt: now,
        },
        tx,
      );

      if (abandoned) {
        await this.fastify.outboxService.recordEvents(
          [
            {
              aggregateType: AggregateTypeEnum.INVOICE,
              aggregateId: invoice.id,
              livemode: invoice.livemode,
              eventType: DomainEventTypeEnum.INVOICE_MARKED_UNCOLLECTIBLE,
              payload: { id: invoice.id, number: invoice.number, attemptCount },
            },
          ],
          tx,
        );
      }
    });

    this.fastify.log.warn(
      { invoiceId: invoice.id, attemptCount },
      '[DunningService] abandonInvoice() gave up collecting and marked it uncollectible',
    );
  }
}
