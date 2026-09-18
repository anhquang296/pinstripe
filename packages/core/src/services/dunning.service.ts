import { MILLISECONDS_PER_DAY } from '@constants/time';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import type { DeclineCode } from '@contracts/payments.types';
import { PaymentIntentStatusEnum } from '@contracts/payments.types';
import type { Invoice, PaymentIntent, PaymentMethod } from '@database/schemas';
import type { DunningRunShardJob } from '@queues/dunning.queue';
import { resolveRetryDelayDays } from '@utils/decline-code';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const REUSABLE_INTENT_STATUSES = [
  PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
  PaymentIntentStatusEnum.REQUIRES_CONFIRMATION,
] as const;

const IN_FLIGHT_INTENT_STATUSES = [
  PaymentIntentStatusEnum.PROCESSING,
  PaymentIntentStatusEnum.REQUIRES_ACTION,
  PaymentIntentStatusEnum.REQUIRES_CAPTURE,
] as const;

export enum DunningOutcomeEnum {
  ATTEMPTED = 'attempted',
  AWAITING = 'awaiting',
  RETRIED = 'retried',
  ABANDONED = 'abandoned',
  SETTLED = 'settled',
}

export type DunningOutcome = `${DunningOutcomeEnum}`;

export interface DunningServiceConfig {
  batchSize: number;
  retryDelayDays: readonly number[];
  inFlightTimeoutMs: number;
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
      [DunningOutcomeEnum.ATTEMPTED]: 0,
      [DunningOutcomeEnum.AWAITING]: 0,
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

  async handlePaymentFailed(
    paymentIntent: PaymentIntent,
    declineCode: DeclineCode,
    failedAt: Date,
  ): Promise<DunningOutcome> {
    const { invoiceId } = paymentIntent;

    if (!invoiceId) {
      return DunningOutcomeEnum.ATTEMPTED;
    }

    const invoice = await this.fastify.invoiceRepository.findInvoice(invoiceId);

    if (!invoice || invoice.status !== InvoiceStatusEnum.OPEN) {
      return DunningOutcomeEnum.SETTLED;
    }

    const now = await this.resolveDunningNow(invoice, failedAt);
    const attemptCount = invoice.attemptCount + 1;
    const nextDelayDays = resolveRetryDelayDays(
      declineCode,
      attemptCount,
      this.config.retryDelayDays,
    );

    await this.fastify.notificationService.dispatchPaymentFailed(paymentIntent);

    if (_.isNil(nextDelayDays)) {
      await this.abandonInvoice(invoice, now, attemptCount);
      await this.markSubscriptionFailed(invoice, now, true);
      await this.fastify.notificationService.dispatchPaymentAbandoned(invoice);

      this.fastify.log.warn(
        { invoiceId: invoice.id, declineCode, attemptCount },
        '[DunningService] handlePaymentFailed() gave up on this invoice',
      );

      return DunningOutcomeEnum.ABANDONED;
    }

    await this.fastify.invoiceRepository.updateInvoice(invoice.id, {
      attemptCount,
      nextAttemptAt: new Date(now.getTime() + nextDelayDays * MILLISECONDS_PER_DAY),
      updatedAt: now,
    });

    await this.markSubscriptionFailed(invoice, now, false);

    this.fastify.log.info(
      { invoiceId: invoice.id, attemptCount, declineCode, nextDelayDays },
      '[DunningService] handlePaymentFailed() scheduled another attempt',
    );

    return DunningOutcomeEnum.RETRIED;
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

    const inFlight = await this.findInFlightIntent(invoice);

    if (inFlight) {
      await this.deferAttempt(invoice, now);

      this.fastify.log.info(
        { invoiceId: invoice.id, paymentIntentId: inFlight.id },
        '[DunningService] collectInvoice() a confirmation is still in flight',
      );

      return DunningOutcomeEnum.AWAITING;
    }

    const paymentMethod = await this.resolvePaymentMethod(invoice);

    if (!paymentMethod) {
      this.fastify.log.warn(
        { invoiceId: invoice.id, customerId: invoice.customerId },
        '[DunningService] collectInvoice() no default payment method to charge',
      );

      return this.failWithoutPaymentMethod(invoice, now);
    }

    const paymentIntentId = await this.resolveCollectionIntentId(invoice, paymentMethod);

    await this.deferAttempt(invoice, now);
    await this.fastify.paymentService.confirmPaymentIntent(
      paymentIntentId,
      { paymentMethodId: paymentMethod.id },
      invoice.livemode,
    );

    return DunningOutcomeEnum.ATTEMPTED;
  }

  private async deferAttempt(invoice: Invoice, now: Date): Promise<void> {
    await this.fastify.invoiceRepository.updateInvoice(invoice.id, {
      nextAttemptAt: new Date(now.getTime() + this.config.inFlightTimeoutMs),
      updatedAt: now,
    });
  }

  private async failWithoutPaymentMethod(invoice: Invoice, now: Date): Promise<DunningOutcome> {
    const attemptCount = invoice.attemptCount + 1;
    const nextDelayDays = resolveRetryDelayDays(null, attemptCount, this.config.retryDelayDays);

    if (_.isNil(nextDelayDays)) {
      await this.abandonInvoice(invoice, now, attemptCount);
      await this.markSubscriptionFailed(invoice, now, true);
      await this.fastify.notificationService.dispatchPaymentAbandoned(invoice);

      return DunningOutcomeEnum.ABANDONED;
    }

    await this.fastify.invoiceRepository.updateInvoice(invoice.id, {
      attemptCount,
      nextAttemptAt: new Date(now.getTime() + nextDelayDays * MILLISECONDS_PER_DAY),
      updatedAt: now,
    });

    await this.markSubscriptionFailed(invoice, now, false);

    return DunningOutcomeEnum.RETRIED;
  }

  private async findInFlightIntent(invoice: Invoice): Promise<PaymentIntent | null> {
    const [inFlight] = await this.fastify.paymentIntentRepository.findPaymentIntents(
      { invoiceId: invoice.id, statuses: IN_FLIGHT_INTENT_STATUSES },
      1,
    );

    return inFlight ?? null;
  }

  private async resolveDunningNow(invoice: Invoice, runAt: Date): Promise<Date> {
    const invoiceNow = await this.fastify.clockService.resolveInvoiceNow(invoice);

    if (invoiceNow.getTime() > runAt.getTime()) {
      return invoiceNow;
    }

    return runAt;
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
    paymentMethod: PaymentMethod,
  ): Promise<string> {
    const [reusableIntent] = await this.fastify.paymentIntentRepository.findPaymentIntents(
      { invoiceId: invoice.id, statuses: REUSABLE_INTENT_STATUSES },
      1,
    );

    if (reusableIntent) {
      return reusableIntent.id;
    }

    const createdIntent = await this.fastify.paymentService.createPaymentIntent(
      { invoiceId: invoice.id, paymentMethodId: paymentMethod.id },
      invoice.livemode,
    );

    return createdIntent.id;
  }

  private async resolvePaymentMethod(invoice: Invoice): Promise<PaymentMethod | null> {
    const paymentMethodId = await this.resolvePaymentMethodId(invoice);

    if (!paymentMethodId) {
      return null;
    }

    const paymentMethod =
      await this.fastify.paymentMethodRepository.findPaymentMethod(paymentMethodId);

    if (paymentMethod && !paymentMethod.detachedAt) {
      return paymentMethod;
    }

    return null;
  }

  private async resolvePaymentMethodId(invoice: Invoice): Promise<string | null> {
    const { subscriptionId } = invoice;

    if (subscriptionId) {
      const subscription =
        await this.fastify.subscriptionRepository.findSubscription(subscriptionId);
      const subscriptionPaymentMethodId = _.get(subscription, 'defaultPaymentMethodId', null);

      if (subscriptionPaymentMethodId) {
        return subscriptionPaymentMethodId;
      }
    }

    const customer = await this.fastify.customerRepository.findCustomer(invoice.customerId);

    return _.get(customer, 'defaultPaymentMethodId', null);
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
