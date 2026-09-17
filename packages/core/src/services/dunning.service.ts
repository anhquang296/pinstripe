import { MILLISECONDS_PER_DAY } from '@constants/time';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import { PaymentIntentStatusEnum } from '@contracts/payments.types';
import type { Invoice } from '@database/schemas';
import type { DunningRunShardJob } from '@queues/dunning.queue';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const DEFAULT_PAYMENT_METHOD = 'pm_card_ok';
const PAYMENT_METHOD_METADATA_KEY = 'defaultPaymentMethod';
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
    const owed = await this.fastify.invoiceService.getInvoice(invoice.id, invoice.livemode);

    if (owed.amountRemaining <= 0) {
      await this.fastify.invoiceRepository.updateInvoice(invoice.id, {
        nextAttemptAt: null,
        updatedAt: runAt,
      });

      return DunningOutcomeEnum.SETTLED;
    }

    const paymentMethod = await this.resolvePaymentMethod(invoice.customerId);
    const paymentIntentId = await this.resolveCollectionIntentId(invoice, paymentMethod);
    const confirmed = await this.fastify.paymentService.confirmPaymentIntent(
      paymentIntentId,
      { paymentMethod },
      invoice.livemode,
    );

    if (confirmed.status === PaymentIntentStatusEnum.SUCCEEDED) {
      await this.fastify.invoiceRepository.updateInvoice(invoice.id, {
        nextAttemptAt: null,
        updatedAt: runAt,
      });

      return DunningOutcomeEnum.COLLECTED;
    }

    const attemptCount = invoice.attemptCount + 1;
    const nextDelayDays = this.config.retryDelayDays[attemptCount];

    if (_.isNil(nextDelayDays)) {
      await this.abandonInvoice(invoice, runAt, attemptCount);

      return DunningOutcomeEnum.ABANDONED;
    }

    await this.fastify.invoiceRepository.updateInvoice(invoice.id, {
      attemptCount,
      nextAttemptAt: new Date(runAt.getTime() + nextDelayDays * MILLISECONDS_PER_DAY),
      updatedAt: runAt,
    });

    this.fastify.log.info(
      { invoiceId: invoice.id, attemptCount, failureCode: confirmed.failureCode },
      '[DunningService] collectInvoice() scheduled another attempt',
    );

    return DunningOutcomeEnum.RETRIED;
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

  private async resolvePaymentMethod(customerId: string): Promise<string> {
    const customer = await this.fastify.customerRepository.findCustomer(customerId);

    return _.get(customer, ['metadata', PAYMENT_METHOD_METADATA_KEY], DEFAULT_PAYMENT_METHOD);
  }

  private async abandonInvoice(invoice: Invoice, runAt: Date, attemptCount: number): Promise<void> {
    await this.fastify.database.master.transaction(async (tx) => {
      const abandoned = await this.fastify.invoiceRepository.updateInvoice(
        invoice.id,
        {
          status: InvoiceStatusEnum.UNCOLLECTIBLE,
          attemptCount,
          nextAttemptAt: null,
          updatedAt: runAt,
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
