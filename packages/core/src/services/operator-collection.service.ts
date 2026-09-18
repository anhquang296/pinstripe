import { CollectionAttemptStatusEnum } from '@contracts/collection-attempts.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import type { LedgerAccountCode } from '@contracts/ledger.types';
import { LedgerAccountCodeEnum } from '@contracts/ledger.types';
import type { CollectionMethod } from '@contracts/subscriptions.types';
import { CollectionMethodEnum } from '@contracts/subscriptions.types';
import type { CollectionAttempt, Invoice } from '@database/schemas';
import { BadRequestError, NotFoundError } from '@errors/app.error';
import type {
  OperatorCollectionPayload,
  OperatorCollectionResult,
} from '@type/operator-collection-provider';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const NOTHING_COLLECTED_MESSAGE = 'No ticket sales or wallet balance was available to collect';
const REQUEST_FAILED_MESSAGE = 'The Vexere collection request failed';

export interface OperatorCollectionOutcome {
  appliedAmount: number;
  isSettled: boolean;
}

type OperatorCollector = (payload: OperatorCollectionPayload) => Promise<OperatorCollectionResult>;

interface OperatorCollectionResponse extends OperatorCollectionResult {
  failureMessage: string | null;
}

export class OperatorCollectionService {
  constructor(private readonly fastify: FastifyInstance) {}

  async collectInvoice(
    invoice: Invoice,
    amountRemaining: number,
    now: Date,
  ): Promise<OperatorCollectionOutcome> {
    const collector = this.resolveCollector(invoice.collectionMethod);
    const customer = await this.fastify.customerRepository.getCustomer(invoice.customerId);
    const { vexereOperatorId } = customer;

    if (vexereOperatorId) {
      const collectionAttempt = await this.resolveCollectionAttempt(invoice, amountRemaining, now);
      const response = await this.requestCollection(
        collector,
        invoice,
        collectionAttempt,
        vexereOperatorId,
      );

      if (response.appliedAmount > 0) {
        const appliedAmount = Math.min(response.appliedAmount, amountRemaining);

        return this.applyCollectionAttempt(
          invoice,
          collectionAttempt,
          { appliedAmount, reference: response.reference },
          now,
        );
      }

      const { failureMessage } = response;

      if (failureMessage) {
        return this.failCollectionAttempt(collectionAttempt, failureMessage, now);
      }

      return this.failCollectionAttempt(collectionAttempt, NOTHING_COLLECTED_MESSAGE, now);
    }

    this.fastify.log.warn(
      { invoiceId: invoice.id, customerId: invoice.customerId },
      '[OperatorCollectionService] collectInvoice() customer has no vexere operator',
    );

    return { appliedAmount: 0, isSettled: false };
  }

  private resolveCollector(collectionMethod: CollectionMethod): OperatorCollector {
    const provider = this.fastify.operatorCollectionProvider;

    if (collectionMethod === CollectionMethodEnum.OFFSET_TICKET) {
      return (payload) => {
        return provider.offsetTicketSales(payload);
      };
    }

    if (collectionMethod === CollectionMethodEnum.DEBIT_WALLET) {
      return (payload) => {
        return provider.debitWallet(payload);
      };
    }

    throw new BadRequestError(
      `Collection method ${collectionMethod} is not collected through Vexere`,
      { param: 'collectionMethod' },
    );
  }

  private async resolveCollectionAttempt(
    invoice: Invoice,
    amountRemaining: number,
    now: Date,
  ): Promise<CollectionAttempt> {
    const [pendingAttempt] = await this.fastify.collectionAttemptRepository.findCollectionAttempts(
      { invoiceId: invoice.id, status: CollectionAttemptStatusEnum.PENDING },
      1,
    );

    if (pendingAttempt) {
      return pendingAttempt;
    }

    const createdAt = now.toISOString();
    const collectionAttempt =
      await this.fastify.collectionAttemptRepository.createCollectionAttempt({
        id: generateGid(ObjectPrefixEnum.COLLECTION_ATTEMPT),
        invoiceId: invoice.id,
        collectionMethod: invoice.collectionMethod,
        requestedAmount: amountRemaining,
        status: CollectionAttemptStatusEnum.PENDING,
        createdAt,
        updatedAt: createdAt,
      });

    if (collectionAttempt) {
      return collectionAttempt;
    }

    throw new NotFoundError(`Collection attempt for invoice ${invoice.id} could not be created`);
  }

  private async requestCollection(
    collector: OperatorCollector,
    invoice: Invoice,
    collectionAttempt: CollectionAttempt,
    vexereOperatorId: string,
  ): Promise<OperatorCollectionResponse> {
    try {
      const collection = await collector({
        operatorId: vexereOperatorId,
        amount: collectionAttempt.requestedAmount,
        currency: invoice.currency,
        idempotencyKey: collectionAttempt.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
      });

      return { ...collection, failureMessage: null };
    } catch (error) {
      this.fastify.log.error(
        { error, invoiceId: invoice.id, collectionAttemptId: collectionAttempt.id },
        '[OperatorCollectionService] requestCollection() error',
      );

      const failureMessage = _.get(error, 'message', REQUEST_FAILED_MESSAGE);

      return { appliedAmount: 0, reference: null, failureMessage };
    }
  }

  private async applyCollectionAttempt(
    invoice: Invoice,
    collectionAttempt: CollectionAttempt,
    collection: OperatorCollectionResult,
    now: Date,
  ): Promise<OperatorCollectionOutcome> {
    const { appliedAmount, reference } = collection;
    const updatedAt = now.toISOString();
    const clearingAccountCode = OperatorCollectionService.resolveClearingAccountCode(
      collectionAttempt.collectionMethod,
    );

    const paidInvoice = await this.fastify.database.master.transaction(async (tx) => {
      const settledInvoice = await this.fastify.invoiceService.applyInvoicePayment(
        invoice.id,
        {
          amount: appliedAmount,
          settlementReference: `collection_attempt:${collectionAttempt.id}`,
          clearingAccountCode,
        },
        tx,
      );

      await this.fastify.collectionAttemptRepository.updateCollectionAttempt(
        collectionAttempt.id,
        {
          status: CollectionAttemptStatusEnum.SUCCEEDED,
          appliedAmount,
          externalReference: reference,
          updatedAt,
        },
        tx,
      );

      return settledInvoice;
    });

    const isSettled = paidInvoice.status === InvoiceStatusEnum.PAID;

    if (isSettled && paidInvoice.subscriptionId) {
      await this.fastify.subscriptionService.handleInvoicePaymentSucceeded(
        paidInvoice.subscriptionId,
        now,
        new Date(paidInvoice.periodEnd),
      );
    }

    this.fastify.log.info(
      {
        invoiceId: invoice.id,
        collectionAttemptId: collectionAttempt.id,
        appliedAmount,
        isSettled,
      },
      '[OperatorCollectionService] applyCollectionAttempt() success',
    );

    return { appliedAmount, isSettled };
  }

  private async failCollectionAttempt(
    collectionAttempt: CollectionAttempt,
    failureMessage: string,
    now: Date,
  ): Promise<OperatorCollectionOutcome> {
    await this.fastify.collectionAttemptRepository.updateCollectionAttempt(collectionAttempt.id, {
      status: CollectionAttemptStatusEnum.FAILED,
      failureMessage,
      updatedAt: now.toISOString(),
    });

    return { appliedAmount: 0, isSettled: false };
  }

  private static resolveClearingAccountCode(collectionMethod: CollectionMethod): LedgerAccountCode {
    if (collectionMethod === CollectionMethodEnum.DEBIT_WALLET) {
      return LedgerAccountCodeEnum.OPERATOR_WALLET_CLEARING;
    }

    return LedgerAccountCodeEnum.TICKET_OFFSET_CLEARING;
  }
}
