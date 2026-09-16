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

export interface DunningOptions {
  batchSize: number;
  retryDelayDays: readonly number[];
}

export interface DunningRunResult {
  scanned: number;
  collected: number;
  retried: number;
  abandoned: number;
  settled: number;
}

export class DunningService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly options: DunningOptions,
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
      this.options.batchSize,
    );

    const dunningRun: DunningRunResult = {
      scanned: due.length,
      collected: 0,
      retried: 0,
      abandoned: 0,
      settled: 0,
    };

    for (const invoice of due) {
      const outcome = await this.collectInvoice(invoice, runAt);

      dunningRun[outcome] += 1;
    }

    this.fastify.log.info(
      { shardIndex: job.shardIndex, ...dunningRun },
      '[DunningService] runDunningShard() completed',
    );

    return dunningRun;
  }

  private async collectInvoice(
    invoice: Invoice,
    runAt: Date,
  ): Promise<'collected' | 'retried' | 'abandoned' | 'settled'> {
    const owed = await this.fastify.invoiceService.getInvoice(invoice.id);

    if (owed.amountRemaining <= 0) {
      await this.fastify.invoiceRepository.updateInvoice(invoice.id, {
        nextAttemptAt: null,
        updatedAt: runAt,
      });

      return 'settled';
    }

    const paymentMethod = await this.resolvePaymentMethod(invoice.customerId);
    const paymentIntent = await this.fastify.paymentService.createPaymentIntent({
      invoiceId: invoice.id,
      paymentMethod,
    });
    const confirmed = await this.fastify.paymentService.confirmPaymentIntent(paymentIntent.id, {});

    if (confirmed.status === PaymentIntentStatusEnum.SUCCEEDED) {
      await this.fastify.invoiceRepository.updateInvoice(invoice.id, {
        nextAttemptAt: null,
        updatedAt: runAt,
      });

      return 'collected';
    }

    const attemptCount = invoice.attemptCount + 1;
    const nextDelayDays = this.options.retryDelayDays[attemptCount];

    if (_.isNil(nextDelayDays)) {
      await this.abandonInvoice(invoice, runAt, attemptCount);

      return 'abandoned';
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

    return 'retried';
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

      if (!abandoned) {
        return;
      }

      await this.fastify.outboxService.recordEvents(
        [
          {
            aggregateType: AggregateTypeEnum.INVOICE,
            aggregateId: invoice.id,
            eventType: DomainEventTypeEnum.INVOICE_MARKED_UNCOLLECTIBLE,
            payload: { id: invoice.id, number: invoice.number, attemptCount },
          },
        ],
        tx,
      );
    });

    this.fastify.log.warn(
      { invoiceId: invoice.id, attemptCount },
      '[DunningService] abandonInvoice() gave up collecting and marked it uncollectible',
    );
  }
}
