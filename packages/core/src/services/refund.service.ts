import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@contracts/ledger.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreateRefundPayload,
  FindRefundsQuery,
  RefundResponse,
} from '@contracts/payments.types';
import { PaymentIntentStatusEnum } from '@contracts/payments.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { PaymentIntent, Refund } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class RefundService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createRefund(payload: CreateRefundPayload): Promise<RefundResponse> {
    const paymentIntent = await this.getPaymentIntent(payload.paymentIntentId);

    if (paymentIntent.status !== PaymentIntentStatusEnum.SUCCEEDED) {
      throw new ConflictError(
        `Payment intent ${paymentIntent.id} never took money and has nothing to refund`,
      );
    }

    const pspReference = paymentIntent.pspReference;

    if (!pspReference) {
      throw new ConflictError(
        `Payment intent ${paymentIntent.id} succeeded without a processor reference and cannot be refunded here`,
      );
    }

    const refundedAmount = await this.resolveRefundedAmount(paymentIntent.id);
    const refundable = paymentIntent.amount - refundedAmount;
    const amount = payload.amount ?? refundable;

    if (amount > refundable) {
      throw new BadRequestError(
        `A refund of ${amount} exceeds the ${refundable} left on payment intent ${paymentIntent.id}`,
        { param: 'amount' },
      );
    }

    const id = generateGid(ObjectPrefixEnum.REFUND);
    const pspRefund = await this.fastify.psp.createRefund({
      reference: pspReference,
      amount,
      currency: paymentIntent.currency,
      idempotencyKey: `refund:${id}`,
    });
    const now = this.fastify.clock.now();

    const createdRefund = await this.fastify.database.master.transaction(async (tx) => {
      const refund = await this.fastify.refundRepository.createRefund(
        {
          id,
          livemode: paymentIntent.livemode,
          paymentIntentId: paymentIntent.id,
          chargeId: paymentIntent.latestChargeId,
          invoiceId: paymentIntent.invoiceId,
          customerId: paymentIntent.customerId,
          currency: paymentIntent.currency,
          amount,
          reason: payload.reason,
          pspReference: pspRefund.reference,
          metadata: payload.metadata ?? {},
          createdAt: now,
        },
        tx,
      );

      if (refund) {
        await this.postRefund(refund, tx);
        await this.recordRefundEvent(refund, tx);

        return refund;
      }

      throw new NotFoundError(`Refund ${id} could not be created`);
    });

    return RefundService.buildRefund(createdRefund);
  }

  async getRefund(id: string, livemode: boolean): Promise<RefundResponse> {
    const refund = await this.fastify.refundRepository.findRefund(id);

    if (refund && refund.livemode === livemode) {
      return RefundService.buildRefund(refund);
    }

    throw new NotFoundError(`No such refund: ${id}`);
  }

  async findRefunds(
    query: FindRefundsQuery,
    livemode: boolean,
  ): Promise<ListResponse<RefundResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.refundRepository.findRefunds(
      {
        livemode,
        invoiceId: query.invoiceId,
        paymentIntentId: query.paymentIntentId,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );

    return {
      object: 'list',
      url: '/v1/refunds',
      hasMore: rows.length > limit,
      data: _(rows).take(limit).map(RefundService.buildRefund).value(),
    };
  }

  private async resolveRefundedAmount(paymentIntentId: string): Promise<number> {
    const rows = await this.fastify.refundRepository.findRefunds({ paymentIntentId });

    return _.sumBy(rows, 'amount');
  }

  private async postRefund(refund: Refund, tx: DatabaseTransaction): Promise<void> {
    await this.fastify.ledgerService.postTransaction(
      {
        description: `Refund ${refund.id} for invoice ${refund.invoiceId}`,
        currency: refund.currency,
        externalId: `refund:${refund.id}`,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.REVENUE,
            direction: PostingDirectionEnum.DEBIT,
            amount: refund.amount,
          },
          {
            accountCode: LedgerAccountCodeEnum.CASH,
            direction: PostingDirectionEnum.CREDIT,
            amount: refund.amount,
          },
        ],
      },
      refund.livemode,
      tx,
    );
  }

  private async recordRefundEvent(refund: Refund, tx: DatabaseTransaction): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.REFUND,
          aggregateId: refund.id,
          livemode: refund.livemode,
          eventType: DomainEventTypeEnum.REFUND_CREATED,
          payload: {
            id: refund.id,
            invoiceId: refund.invoiceId,
            paymentIntentId: refund.paymentIntentId,
            amount: refund.amount,
          },
        },
      ],
      tx,
    );
  }

  private async getPaymentIntent(id: string): Promise<PaymentIntent> {
    const paymentIntent = await this.fastify.paymentIntentRepository.findPaymentIntent(id);

    if (paymentIntent) {
      return paymentIntent;
    }

    throw new NotFoundError(`No such payment intent: ${id}`);
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const refund = await this.fastify.refundRepository.findRefund(id);

      if (refund) {
        return { createdAt: refund.createdAt, id: refund.id };
      }

      throw new NotFoundError(`No such refund: ${id}`);
    }

    return undefined;
  }

  private static buildRefund(entity: Refund): RefundResponse {
    return {
      object: 'refund',
      id: entity.id,
      paymentIntentId: entity.paymentIntentId,
      chargeId: entity.chargeId,
      invoiceId: entity.invoiceId,
      customerId: entity.customerId,
      currency: entity.currency,
      amount: entity.amount,
      reason: entity.reason,
      pspReference: entity.pspReference,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
