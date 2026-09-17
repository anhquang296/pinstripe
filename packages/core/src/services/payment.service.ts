import type { PspFailureCode } from '@clients/mock-psp.client';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CancelPaymentIntentPayload,
  ConfirmPaymentIntentPayload,
  CreatePaymentIntentPayload,
  GetPaymentIntentsQuery,
  PaymentIntentResponse,
  PaymentIntentStatus,
} from '@contracts/payments.types';
import {
  PAYMENT_INTENT_TRANSITIONS,
  PaymentAttemptOutcomeEnum,
  PaymentIntentStatusEnum,
} from '@contracts/payments.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { Invoice, PaymentAttempt, PaymentIntent } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const DEFAULT_PAYMENT_METHOD = 'pm_card_ok';

export class PaymentService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createPaymentIntent(payload: CreatePaymentIntentPayload): Promise<PaymentIntentResponse> {
    const invoice = await this.getInvoice(payload.invoiceId);

    if (invoice.status !== InvoiceStatusEnum.OPEN) {
      throw new ConflictError(
        `Invoice ${invoice.id} is ${invoice.status} and cannot take a payment; only an open invoice can`,
      );
    }

    const owed = await this.resolveOwed(invoice);

    if (owed <= 0) {
      throw new ConflictError(`Invoice ${invoice.id} has nothing left to pay`);
    }

    const amount = payload.amount ?? owed;

    if (amount > owed) {
      throw new BadRequestError(
        `A payment intent of ${amount} exceeds the ${owed} still owed on invoice ${invoice.id}`,
        { param: 'amount' },
      );
    }

    const now = this.fastify.clock.now();
    const id = generateGid(ObjectPrefixEnum.PAYMENT_INTENT);
    const paymentMethod = payload.paymentMethod ?? null;

    const createdPaymentIntent = await this.fastify.paymentIntentRepository.createPaymentIntent({
      id,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      status: paymentMethod
        ? PaymentIntentStatusEnum.REQUIRES_CONFIRMATION
        : PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
      currency: invoice.currency,
      amount,
      paymentMethod,
      pspReference: null,
      failureCode: null,
      failureMessage: null,
      metadata: payload.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    });

    if (createdPaymentIntent) {
      return this.buildPaymentIntent(createdPaymentIntent);
    }

    throw new NotFoundError(`Payment intent ${id} could not be created`);
  }

  async confirmPaymentIntent(
    id: string,
    payload: ConfirmPaymentIntentPayload,
  ): Promise<PaymentIntentResponse> {
    const paymentIntent = await this.getPaymentIntentEntity(id);

    PaymentService.assertTransition(paymentIntent.status, PaymentIntentStatusEnum.SUCCEEDED);

    const paymentMethod =
      payload.paymentMethod ?? paymentIntent.paymentMethod ?? DEFAULT_PAYMENT_METHOD;
    const charge = await this.fastify.psp.createCharge({
      paymentMethod,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      idempotencyKey: `charge:${paymentIntent.id}`,
    });
    const now = this.fastify.clock.now();

    if (!charge.isApproved) {
      return this.recordDeclinedAttempt(paymentIntent, paymentMethod, charge.failureCode, {
        failureMessage: charge.failureMessage,
        now,
      });
    }

    const succeededPaymentIntent = await this.fastify.database.master.transaction(async (tx) => {
      const updatedPaymentIntent = await this.fastify.paymentIntentRepository.updatePaymentIntent(
        paymentIntent.id,
        {
          status: PaymentIntentStatusEnum.SUCCEEDED,
          paymentMethod,
          pspReference: charge.reference,
          failureCode: null,
          failureMessage: null,
          updatedAt: now,
        },
        tx,
      );

      if (updatedPaymentIntent) {
        await this.fastify.paymentIntentRepository.createPaymentAttempt(
          {
            id: generateGid(ObjectPrefixEnum.CHARGE),
            paymentIntentId: paymentIntent.id,
            paymentMethod,
            outcome: PaymentAttemptOutcomeEnum.SUCCEEDED,
            pspReference: charge.reference,
            failureCode: null,
            createdAt: now,
          },
          tx,
        );

        await this.recordPaymentEvent(
          updatedPaymentIntent,
          DomainEventTypeEnum.PAYMENT_INTENT_SUCCEEDED,
          tx,
        );

        return updatedPaymentIntent;
      }

      throw new NotFoundError(`No such payment intent: ${paymentIntent.id}`);
    });

    await this.fastify.invoiceService.payInvoice(
      paymentIntent.invoiceId,
      { amount: paymentIntent.amount },
      `payment_intent:${paymentIntent.id}`,
    );

    return this.buildPaymentIntent(succeededPaymentIntent);
  }

  async cancelPaymentIntent(
    id: string,
    payload: CancelPaymentIntentPayload,
  ): Promise<PaymentIntentResponse> {
    const paymentIntent = await this.getPaymentIntentEntity(id);

    PaymentService.assertTransition(paymentIntent.status, PaymentIntentStatusEnum.CANCELED);

    const now = this.fastify.clock.now();
    const canceledPaymentIntent = await this.fastify.paymentIntentRepository.updatePaymentIntent(
      paymentIntent.id,
      {
        status: PaymentIntentStatusEnum.CANCELED,
        metadata: { ...paymentIntent.metadata, ...(payload.metadata ?? {}) },
        updatedAt: now,
      },
    );

    if (canceledPaymentIntent) {
      return this.buildPaymentIntent(canceledPaymentIntent);
    }

    throw new NotFoundError(`No such payment intent: ${paymentIntent.id}`);
  }

  async getPaymentIntent(id: string): Promise<PaymentIntentResponse> {
    const paymentIntent = await this.getPaymentIntentEntity(id);

    return this.buildPaymentIntent(paymentIntent);
  }

  async findPaymentIntents(
    query: GetPaymentIntentsQuery,
  ): Promise<ListResponse<PaymentIntentResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.paymentIntentRepository.findPaymentIntents(
      {
        invoiceId: query.invoiceId,
        customerId: query.customerId,
        status: query.status,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );
    const page = _.take(rows, limit);
    const attemptsByIntentId = await this.resolveAttempts(_.map(page, 'id'));

    return {
      object: 'list',
      url: '/v1/payment_intents',
      hasMore: rows.length > limit,
      data: _.map(page, (paymentIntent) => {
        const attempts = _.get(attemptsByIntentId, paymentIntent.id, []);

        return PaymentService.buildPaymentIntentWithAttempts(paymentIntent, attempts);
      }),
    };
  }

  private async recordDeclinedAttempt(
    paymentIntent: PaymentIntent,
    paymentMethod: string,
    failureCode: PspFailureCode | null,
    context: { failureMessage: string | null; now: Date },
  ): Promise<PaymentIntentResponse> {
    const declinedPaymentIntent = await this.fastify.database.master.transaction(async (tx) => {
      const updatedPaymentIntent = await this.fastify.paymentIntentRepository.updatePaymentIntent(
        paymentIntent.id,
        {
          status: PaymentIntentStatusEnum.REQUIRES_PAYMENT_METHOD,
          paymentMethod,
          failureCode,
          failureMessage: context.failureMessage,
          updatedAt: context.now,
        },
        tx,
      );

      if (updatedPaymentIntent) {
        await this.fastify.paymentIntentRepository.createPaymentAttempt(
          {
            id: generateGid(ObjectPrefixEnum.CHARGE),
            paymentIntentId: paymentIntent.id,
            paymentMethod,
            outcome: PaymentAttemptOutcomeEnum.DECLINED,
            pspReference: null,
            failureCode,
            createdAt: context.now,
          },
          tx,
        );

        await this.recordPaymentEvent(
          updatedPaymentIntent,
          DomainEventTypeEnum.PAYMENT_INTENT_FAILED,
          tx,
        );

        return updatedPaymentIntent;
      }

      throw new NotFoundError(`No such payment intent: ${paymentIntent.id}`);
    });

    return this.buildPaymentIntent(declinedPaymentIntent);
  }

  private async resolveOwed(invoice: Invoice): Promise<number> {
    const invoiceResponse = await this.fastify.invoiceService.getInvoice(invoice.id);

    return invoiceResponse.amountRemaining;
  }

  private async recordPaymentEvent(
    paymentIntent: PaymentIntent,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.PAYMENT_INTENT,
          aggregateId: paymentIntent.id,
          eventType,
          payload: {
            id: paymentIntent.id,
            invoiceId: paymentIntent.invoiceId,
            amount: paymentIntent.amount,
            status: paymentIntent.status,
          },
        },
      ],
      tx,
    );
  }

  private async getInvoice(id: string): Promise<Invoice> {
    const invoice = await this.fastify.invoiceRepository.findInvoice(id);

    if (invoice) {
      return invoice;
    }

    throw new NotFoundError(`No such invoice: ${id}`);
  }

  private async getPaymentIntentEntity(id: string): Promise<PaymentIntent> {
    const paymentIntent = await this.fastify.paymentIntentRepository.findPaymentIntent(id);

    if (paymentIntent) {
      return paymentIntent;
    }

    throw new NotFoundError(`No such payment intent: ${id}`);
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const paymentIntent = await this.getPaymentIntentEntity(id);

      return { createdAt: paymentIntent.createdAt, id: paymentIntent.id };
    }

    return undefined;
  }

  private async resolveAttempts(
    paymentIntentIds: readonly string[],
  ): Promise<Record<string, PaymentAttempt[]>> {
    const rows = await this.fastify.paymentIntentRepository.findPaymentAttempts(paymentIntentIds);

    return _.groupBy(rows, 'paymentIntentId');
  }

  private async buildPaymentIntent(paymentIntent: PaymentIntent): Promise<PaymentIntentResponse> {
    const attempts = await this.fastify.paymentIntentRepository.findPaymentAttempts([
      paymentIntent.id,
    ]);

    return PaymentService.buildPaymentIntentWithAttempts(paymentIntent, attempts);
  }

  private static assertTransition(from: PaymentIntentStatus, to: PaymentIntentStatus): void {
    if (_.includes(PAYMENT_INTENT_TRANSITIONS[from], to)) {
      return;
    }

    throw new ConflictError(`A payment intent cannot move from ${from} to ${to}`);
  }

  private static buildPaymentIntentWithAttempts(
    paymentIntent: PaymentIntent,
    attempts: readonly PaymentAttempt[],
  ): PaymentIntentResponse {
    return {
      object: 'payment_intent',
      id: paymentIntent.id,
      invoiceId: paymentIntent.invoiceId,
      customerId: paymentIntent.customerId,
      status: paymentIntent.status,
      currency: paymentIntent.currency,
      amount: paymentIntent.amount,
      paymentMethod: paymentIntent.paymentMethod,
      pspReference: paymentIntent.pspReference,
      failureCode: paymentIntent.failureCode,
      failureMessage: paymentIntent.failureMessage,
      attempts: _.map(attempts, (attempt) => {
        return {
          object: 'payment_attempt' as const,
          id: attempt.id,
          paymentMethod: attempt.paymentMethod,
          outcome: attempt.outcome,
          pspReference: attempt.pspReference,
          failureCode: attempt.failureCode,
          createdAt: attempt.createdAt.toISOString(),
        };
      }),
      metadata: paymentIntent.metadata,
      createdAt: paymentIntent.createdAt.toISOString(),
      updatedAt: paymentIntent.updatedAt.toISOString(),
    };
  }
}
