import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreateRefundPayload,
  FindRefundsQuery,
  RefundResponse,
  RefundStatus,
} from '@contracts/payments.types';
import { ChargeStatusEnum, REFUND_TRANSITIONS, RefundStatusEnum } from '@contracts/payments.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { Charge, NewRefund, Refund } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const REFUND_SCAN_LIMIT = 100;
const SINGLE_ROW_LIMIT = 1;

export class RefundService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createRefund(payload: CreateRefundPayload, creditNoteId?: string): Promise<RefundResponse> {
    const charge = await this.getChargeEntity(payload.chargeId);
    const refundable = await this.resolveRefundableAmount(charge);
    const amount = payload.amount ?? refundable;

    if (amount > refundable) {
      throw new BadRequestError(
        `A refund of ${amount} exceeds the ${refundable} left on charge ${charge.id}`,
        { param: 'amount' },
      );
    }

    const refundPayload = await this.requestRefund(
      charge,
      amount,
      payload.reason,
      creditNoteId ?? null,
      payload.metadata ?? {},
    );
    const createdRefund = await this.fastify.database.master.transaction(async (tx) => {
      return this.writeRefund(refundPayload, tx);
    });

    return RefundService.buildRefund(createdRefund, RefundStatusEnum.PENDING);
  }

  async requestRefund(
    charge: Charge,
    amount: number,
    reason: string,
    creditNoteId: string | null,
    metadata: Record<string, string>,
  ): Promise<NewRefund> {
    const { pspReference } = charge;

    if (!pspReference) {
      throw new ConflictError(
        `Charge ${charge.id} settled without a processor reference and cannot be refunded here`,
      );
    }

    const id = generateGid(ObjectPrefixEnum.REFUND);
    const pspRefund = await this.fastify.psp.createRefund({
      reference: pspReference,
      amount,
      currency: charge.currency,
      idempotencyKey: `refund:${id}`,
    });

    return {
      id,
      paymentIntentId: charge.paymentIntentId,
      chargeId: charge.id,
      invoiceId: await this.resolveInvoiceId(charge.paymentIntentId),
      creditNoteId,
      customerId: charge.customerId,
      currency: charge.currency,
      amount,
      reason,
      pspReference: pspRefund.reference,
      metadata,
      createdAt: this.fastify.clock.now().toISOString(),
    };
  }

  async writeRefund(payload: NewRefund, tx: DatabaseTransaction): Promise<Refund> {
    const refund = await this.fastify.refundRepository.createRefund(payload, tx);

    if (!refund) {
      throw new NotFoundError(`Refund ${payload.id} could not be created`);
    }

    await this.recordTransition(refund, RefundStatusEnum.PENDING, null, tx);
    await this.recordRefundEvent(refund, DomainEventTypeEnum.REFUND_CREATED, tx);

    return refund;
  }

  async handleRefundSucceeded(pspReference: string): Promise<void> {
    const refund = await this.getProcessorRefund(pspReference);
    const status = await this.resolveStatus(refund.id);

    RefundService.assertTransition(status, RefundStatusEnum.SUCCEEDED);

    await this.fastify.database.master.transaction(async (tx) => {
      await this.recordTransition(refund, RefundStatusEnum.SUCCEEDED, null, tx);
      await this.fastify.balanceService.recordRefundSettlement(refund, tx);
      await this.applyChargeRefund(refund, tx);
      await this.recordRefundEvent(refund, DomainEventTypeEnum.REFUND_UPDATED, tx);
    });

    this.fastify.log.info(
      { refundId: refund.id, amount: refund.amount },
      '[RefundService] handleRefundSucceeded() returned the money',
    );
  }

  async handleRefundFailed(pspReference: string, failureReason: string | null): Promise<void> {
    const refund = await this.getProcessorRefund(pspReference);
    const status = await this.resolveStatus(refund.id);

    RefundService.assertTransition(status, RefundStatusEnum.FAILED);

    await this.fastify.database.master.transaction(async (tx) => {
      await this.recordTransition(refund, RefundStatusEnum.FAILED, failureReason, tx);
      await this.recordRefundEvent(refund, DomainEventTypeEnum.REFUND_UPDATED, tx);
    });

    this.fastify.log.warn(
      { refundId: refund.id, failureReason },
      '[RefundService] handleRefundFailed() the processor refused the refund',
    );
  }

  async getRefund(id: string): Promise<RefundResponse> {
    const refund = await this.fastify.refundRepository.findRefund(id);

    if (refund) {
      const [built] = await this.buildRefunds([refund]);

      if (built) {
        return built;
      }
    }

    throw new NotFoundError(`No such refund: ${id}`);
  }

  async findRefunds(query: FindRefundsQuery): Promise<ListResponse<RefundResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.refundRepository.findRefunds(
      {
        invoiceId: query.invoiceId,
        chargeId: query.chargeId,
        paymentIntentId: query.paymentIntentId,
        statuses: query.status ? [query.status] : undefined,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );

    return {
      url: '/v1/refunds',
      hasMore: rows.length > limit,
      data: await this.buildRefunds(_.take(rows, limit)),
    };
  }

  async resolveStatus(refundId: string): Promise<RefundStatus> {
    const transitions = await this.fastify.refundRepository.findRefundTransitions([refundId]);
    const [latest] = transitions;

    if (latest) {
      return latest.status;
    }

    throw new NotFoundError(`Refund ${refundId} has no recorded status`);
  }

  private async buildRefunds(refunds: readonly Refund[]): Promise<RefundResponse[]> {
    const transitions = await this.fastify.refundRepository.findRefundTransitions(
      _.map(refunds, 'id'),
    );
    const latestByRefundId = _.keyBy(
      _.orderBy(transitions, ['occurredAt', 'id'], ['asc', 'asc']),
      'refundId',
    );

    return _.map(refunds, (refund) => {
      const latest = latestByRefundId[refund.id];
      const status: RefundStatus = _.get(latest, 'status', RefundStatusEnum.PENDING);

      return RefundService.buildRefund(refund, status, _.get(latest, 'failureReason', null));
    });
  }

  private async resolveRefundableAmount(charge: Charge): Promise<number> {
    const rows = await this.fastify.refundRepository.findRefunds(
      {
        chargeId: charge.id,
        statuses: [RefundStatusEnum.PENDING, RefundStatusEnum.SUCCEEDED],
      },
      REFUND_SCAN_LIMIT,
    );

    return charge.amountCaptured - _.sumBy(rows, 'amount');
  }

  private async applyChargeRefund(refund: Refund, tx: DatabaseTransaction): Promise<void> {
    const charge = await this.fastify.paymentIntentRepository.findCharge(refund.chargeId);

    if (!charge) {
      throw new NotFoundError(`No such charge: ${refund.chargeId}`);
    }

    await this.fastify.paymentIntentRepository.updateCharge(
      charge.id,
      {
        amountRefunded: charge.amountRefunded + refund.amount,
        updatedAt: this.fastify.clock.now().toISOString(),
      },
      tx,
    );
  }

  private async recordTransition(
    refund: Refund,
    status: RefundStatus,
    failureReason: string | null,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.refundRepository.createRefundTransition(
      {
        id: generateGid(ObjectPrefixEnum.REFUND_TRANSITION),
        refundId: refund.id,
        status,
        failureReason,
        occurredAt: this.fastify.clock.now().toISOString(),
      },
      tx,
    );
  }

  private async recordRefundEvent(
    refund: Refund,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.REFUND,
          aggregateId: refund.id,
          eventType,
          payload: {
            id: refund.id,
            invoiceId: refund.invoiceId,
            chargeId: refund.chargeId,
            amount: refund.amount,
          },
        },
      ],
      tx,
    );
  }

  private async resolveInvoiceId(paymentIntentId: string): Promise<string | null> {
    const paymentIntent =
      await this.fastify.paymentIntentRepository.findPaymentIntent(paymentIntentId);

    return _.get(paymentIntent, 'invoiceId', null);
  }

  private async getChargeEntity(id: string): Promise<Charge> {
    const charge = await this.fastify.paymentIntentRepository.findCharge(id);

    if (!charge) {
      throw new NotFoundError(`No such charge: ${id}`);
    }

    if (charge.status !== ChargeStatusEnum.SUCCEEDED) {
      throw new ConflictError(`Charge ${id} never took money and has nothing to refund`);
    }

    return charge;
  }

  private async getProcessorRefund(pspReference: string): Promise<Refund> {
    const [refund] = await this.fastify.refundRepository.findRefunds(
      { pspReference },
      SINGLE_ROW_LIMIT,
    );

    if (refund) {
      return refund;
    }

    throw new NotFoundError(`No refund for processor reference ${pspReference}`);
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

  private static assertTransition(from: RefundStatus, to: RefundStatus): void {
    if (_.includes(REFUND_TRANSITIONS[from], to)) {
      return;
    }

    throw new ConflictError(`A refund cannot move from ${from} to ${to}`);
  }

  private static buildRefund(
    entity: Refund,
    status: RefundStatus,
    failureReason: string | null = null,
  ): RefundResponse {
    return { ...entity, status, failureReason };
  }
}
