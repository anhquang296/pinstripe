import type {
  DisputeOutcome,
  DisputeReason,
  DisputeResponse,
  DisputeStatus,
  FindDisputesQuery,
  SubmitDisputeEvidencePayload,
} from '@contracts/disputes.types';
import {
  DISPUTE_TRANSITIONS,
  DisputeOutcomeEnum,
  DisputeStatusEnum,
} from '@contracts/disputes.types';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import { ChargeStatusEnum } from '@contracts/payments.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { Charge, Dispute } from '@database/schemas';
import { ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const SINGLE_ROW_LIMIT = 1;

export interface DisputeOpenedPayload {
  pspReference: string;
  chargeReference: string;
  amount: number;
  reason: DisputeReason;
}

export class DisputeService {
  constructor(private readonly fastify: FastifyInstance) {}

  async getDispute(id: string): Promise<DisputeResponse> {
    return this.fastify.disputeRepository.getDispute(id);
  }

  async findDisputes(query: FindDisputesQuery): Promise<ListResponse<DisputeResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);

    const rows = await this.fastify.disputeRepository.findDisputes(
      {
        chargeId: query.chargeId,
        customerId: query.customerId,
        status: query.status,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );

    return {
      url: '/v1/disputes',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  async submitDisputeEvidence(
    id: string,
    payload: SubmitDisputeEvidencePayload,
  ): Promise<DisputeResponse> {
    const dispute = await this.fastify.disputeRepository.getDispute(id);

    DisputeService.assertTransition(dispute.status, DisputeStatusEnum.UNDER_REVIEW);

    const evidenceSubmittedAt = this.fastify.clock.now().toISOString();

    const reviewedDispute = await this.fastify.database.master.transaction(async (tx) => {
      const updatedDispute = await this.fastify.disputeRepository.updateDispute(
        dispute.id,
        {
          status: DisputeStatusEnum.UNDER_REVIEW,
          evidence: { ...dispute.evidence, ...payload.evidence },
          evidenceSubmittedAt,
          metadata: { ...dispute.metadata, ...payload.metadata },
          updatedAt: evidenceSubmittedAt,
        },
        tx,
      );

      if (!updatedDispute) {
        throw new NotFoundError(`No such dispute: ${id}`);
      }

      await this.recordDisputeEvent(updatedDispute, DomainEventTypeEnum.DISPUTE_UPDATED, tx);

      return updatedDispute;
    });

    return reviewedDispute;
  }

  async handleDisputeOpened(payload: DisputeOpenedPayload): Promise<void> {
    const recordedDisputes = await this.fastify.disputeRepository.findDisputes(
      { pspReference: payload.pspReference },
      SINGLE_ROW_LIMIT,
    );

    if (!_.isEmpty(recordedDisputes)) {
      this.fastify.log.info(
        { pspReference: payload.pspReference },
        '[DisputeService] handleDisputeOpened() skipped, this dispute is already recorded',
      );

      return;
    }

    const charge = await this.getSettledCharge(payload.chargeReference);

    const createdAt = this.fastify.clock.now().toISOString();

    const id = generateGid(ObjectPrefixEnum.DISPUTE);

    const paymentIntent = await this.fastify.paymentIntentRepository.findPaymentIntent(
      charge.paymentIntentId,
    );

    const invoiceId = _.get(paymentIntent, 'invoiceId', null);

    const openedDispute = await this.fastify.database.master.transaction(async (tx) => {
      const dispute = await this.fastify.disputeRepository.createDispute(
        {
          id,
          chargeId: charge.id,
          paymentIntentId: charge.paymentIntentId,
          invoiceId,
          customerId: charge.customerId,
          currency: charge.currency,
          amount: payload.amount,
          status: DisputeStatusEnum.NEEDS_RESPONSE,
          reason: payload.reason,
          evidence: {},
          evidenceSubmittedAt: null,
          closedAt: null,
          pspReference: payload.pspReference,
          metadata: {},
          createdAt,
          updatedAt: createdAt,
        },
        tx,
      );

      if (!dispute) {
        throw new NotFoundError(`Dispute ${id} could not be recorded`);
      }

      await this.fastify.balanceService.recordDisputeHold(dispute, tx);
      await this.recordDisputeEvent(dispute, DomainEventTypeEnum.DISPUTE_CREATED, tx);

      return dispute;
    });

    await this.suspendBilling(openedDispute, false);

    this.fastify.log.warn(
      { disputeId: openedDispute.id, chargeId: charge.id, amount: payload.amount },
      '[DisputeService] handleDisputeOpened() withheld the disputed amount',
    );
  }

  async handleDisputeClosed(pspReference: string, outcome: DisputeOutcome): Promise<void> {
    const dispute = await this.getProcessorDispute(pspReference);

    const status =
      outcome === DisputeOutcomeEnum.WON ? DisputeStatusEnum.WON : DisputeStatusEnum.LOST;

    DisputeService.assertTransition(dispute.status, status);

    const closedAt = this.fastify.clock.now().toISOString();

    const closedDispute = await this.fastify.database.master.transaction(async (tx) => {
      const updatedDispute = await this.fastify.disputeRepository.updateDispute(
        dispute.id,
        { status, closedAt, updatedAt: closedAt },
        tx,
      );

      if (!updatedDispute) {
        throw new NotFoundError(`No such dispute: ${dispute.id}`);
      }

      if (status === DisputeStatusEnum.WON) {
        await this.fastify.balanceService.recordDisputeReversal(updatedDispute, tx);
      } else {
        await this.fastify.balanceService.recordDisputeLoss(updatedDispute, tx);
      }

      await this.recordDisputeEvent(updatedDispute, DomainEventTypeEnum.DISPUTE_CLOSED, tx);

      return updatedDispute;
    });

    await this.restoreBilling(closedDispute);

    this.fastify.log.info(
      { disputeId: closedDispute.id, status },
      '[DisputeService] handleDisputeClosed() closed the dispute',
    );
  }

  private async suspendBilling(dispute: Dispute, isFinal: boolean): Promise<void> {
    const subscriptionId = await this.resolveSubscriptionId(dispute);

    if (!subscriptionId) {
      return;
    }

    await this.fastify.subscriptionService.handleInvoicePaymentFailed(
      subscriptionId,
      this.fastify.clock.now(),
      isFinal,
    );
    await this.fastify.entitlementService.handleSubscriptionChanged(subscriptionId);
  }

  private async restoreBilling(dispute: Dispute): Promise<void> {
    if (dispute.status === DisputeStatusEnum.LOST) {
      await this.suspendBilling(dispute, true);

      return;
    }

    const subscriptionId = await this.resolveSubscriptionId(dispute);

    const invoice = dispute.invoiceId
      ? await this.fastify.invoiceRepository.findInvoice(dispute.invoiceId)
      : null;

    if (!subscriptionId || !invoice) {
      return;
    }

    const periodEnd = new Date(invoice.periodEnd);

    await this.fastify.subscriptionService.handleInvoicePaymentSucceeded(
      subscriptionId,
      this.fastify.clock.now(),
      periodEnd,
    );
    await this.fastify.entitlementService.handleSubscriptionChanged(subscriptionId);
  }

  private async resolveSubscriptionId(dispute: Dispute): Promise<string | null> {
    const { invoiceId } = dispute;

    if (!invoiceId) {
      return null;
    }

    const invoice = await this.fastify.invoiceRepository.findInvoice(invoiceId);

    return _.get(invoice, 'subscriptionId', null);
  }

  private async recordDisputeEvent(
    dispute: Dispute,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.DISPUTE,
          aggregateId: dispute.id,
          eventType,
          payload: {
            id: dispute.id,
            chargeId: dispute.chargeId,
            amount: dispute.amount,
            status: dispute.status,
            reason: dispute.reason,
          },
        },
      ],
      tx,
    );
  }

  private async getSettledCharge(pspReference: string): Promise<Charge> {
    const [charge] = await this.fastify.paymentIntentRepository.findCharges(
      { pspReference, status: ChargeStatusEnum.SUCCEEDED },
      SINGLE_ROW_LIMIT,
    );

    if (charge) {
      return charge;
    }

    throw new NotFoundError(`No settled charge for processor reference ${pspReference}`);
  }

  private async getProcessorDispute(pspReference: string): Promise<Dispute> {
    const [dispute] = await this.fastify.disputeRepository.findDisputes(
      { pspReference },
      SINGLE_ROW_LIMIT,
    );

    if (dispute) {
      return dispute;
    }

    throw new NotFoundError(`No dispute for processor reference ${pspReference}`);
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const dispute = await this.fastify.disputeRepository.getDispute(id);

      return { createdAt: dispute.createdAt, id: dispute.id };
    }

    return undefined;
  }

  private static assertTransition(from: DisputeStatus, to: DisputeStatus): void {
    if (_.includes(DISPUTE_TRANSITIONS[from], to)) {
      return;
    }

    throw new ConflictError(`A dispute cannot move from ${from} to ${to}`);
  }
}
