import { MILLISECONDS_PER_DAY } from '@constants/time';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@contracts/ledger.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreatePayoutPayload,
  FindPayoutsQuery,
  PayoutResponse,
  PayoutStatus,
} from '@contracts/payouts.types';
import { PAYOUT_TRANSITIONS, PayoutStatusEnum } from '@contracts/payouts.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { Payout } from '@database/schemas';
import { ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const PAYOUT_ARRIVAL_DAYS = 1;
const SWEEP_LIMIT = 500;
const DUE_PAYOUT_LIMIT = 100;

export class PayoutService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createPayout(payload: CreatePayoutPayload): Promise<PayoutResponse> {
    const now = this.fastify.clock.now();
    const createdAt = now.toISOString();
    const sweepable =
      await this.fastify.balanceTransactionRepository.findSweepableBalanceTransactions(
        payload.currency,
        createdAt,
        SWEEP_LIMIT,
      );
    const amount = _.sumBy(sweepable, 'net');

    if (amount <= 0) {
      throw new ConflictError(
        `There is no available ${payload.currency} balance to pay out right now`,
      );
    }

    const id = generateGid(ObjectPrefixEnum.PAYOUT);
    const pspPayout = await this.fastify.psp.createPayout({
      amount,
      currency: payload.currency,
      idempotencyKey: `payout:${id}`,
    });

    const createdPayout = await this.fastify.database.master.transaction(async (tx) => {
      const payout = await this.fastify.payoutRepository.createPayout(
        {
          id,
          currency: payload.currency,
          amount,
          status: PayoutStatusEnum.IN_TRANSIT,
          statementDescriptor: payload.statementDescriptor ?? null,
          arrivalAt: new Date(
            now.getTime() + PAYOUT_ARRIVAL_DAYS * MILLISECONDS_PER_DAY,
          ).toISOString(),
          paidAt: null,
          failureCode: null,
          failureMessage: null,
          pspReference: pspPayout.reference,
          metadata: payload.metadata ?? {},
          createdAt,
          updatedAt: createdAt,
        },
        tx,
      );

      if (!payout) {
        throw new NotFoundError(`Payout ${id} could not be created`);
      }

      await this.fastify.balanceTransactionRepository.assignBalanceTransactions(
        _.map(sweepable, 'id'),
        payout.id,
        tx,
      );
      await this.postPayoutLeaving(payout, tx);
      await this.recordPayoutEvent(payout, DomainEventTypeEnum.PAYOUT_CREATED, tx);

      return payout;
    });

    this.fastify.log.info(
      { payoutId: createdPayout.id, amount, swept: sweepable.length },
      '[PayoutService] createPayout() swept the available balance',
    );

    return createdPayout;
  }

  async getPayout(id: string): Promise<PayoutResponse> {
    return this.fastify.payoutRepository.getPayout(id);
  }

  async findPayouts(query: FindPayoutsQuery): Promise<ListResponse<PayoutResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.payoutRepository.findPayouts(
      { status: query.status, beforeAt, afterAt },
      limit + 1,
    );

    return {
      url: '/v1/payouts',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  async settleDuePayouts(): Promise<number> {
    const due = await this.fastify.payoutRepository.findPayouts(
      {
        status: PayoutStatusEnum.IN_TRANSIT,
        arrivalBeforeAt: this.fastify.clock.now().toISOString(),
      },
      DUE_PAYOUT_LIMIT,
    );

    for (const payout of due) {
      const { pspReference } = payout;

      if (pspReference) {
        this.fastify.psp.settlePayout(pspReference);
      }
    }

    return due.length;
  }

  async handlePayoutPaid(pspReference: string): Promise<void> {
    const payout = await this.getProcessorPayout(pspReference);

    PayoutService.assertTransition(payout.status, PayoutStatusEnum.PAID);

    const paidAt = this.fastify.clock.now().toISOString();

    await this.fastify.database.master.transaction(async (tx) => {
      const paidPayout = await this.fastify.payoutRepository.updatePayout(
        payout.id,
        { status: PayoutStatusEnum.PAID, paidAt, updatedAt: paidAt },
        tx,
      );

      if (!paidPayout) {
        throw new NotFoundError(`No such payout: ${payout.id}`);
      }

      await this.postPayoutArrival(paidPayout, tx);
      await this.recordPayoutEvent(paidPayout, DomainEventTypeEnum.PAYOUT_PAID, tx);
    });

    this.fastify.log.info({ payoutId: payout.id }, '[PayoutService] handlePayoutPaid() settled');
  }

  async handlePayoutFailed(
    pspReference: string,
    failure: { failureCode: string | null; failureMessage: string | null },
  ): Promise<void> {
    const payout = await this.getProcessorPayout(pspReference);

    PayoutService.assertTransition(payout.status, PayoutStatusEnum.FAILED);

    const updatedAt = this.fastify.clock.now().toISOString();

    await this.fastify.database.master.transaction(async (tx) => {
      const failedPayout = await this.fastify.payoutRepository.updatePayout(
        payout.id,
        {
          status: PayoutStatusEnum.FAILED,
          failureCode: failure.failureCode,
          failureMessage: failure.failureMessage,
          updatedAt,
        },
        tx,
      );

      if (!failedPayout) {
        throw new NotFoundError(`No such payout: ${payout.id}`);
      }

      const sweptTransactions =
        await this.fastify.balanceTransactionRepository.findBalanceTransactions(
          { payoutId: failedPayout.id },
          SWEEP_LIMIT,
        );

      await this.fastify.balanceTransactionRepository.assignBalanceTransactions(
        _.map(sweptTransactions, 'id'),
        null,
        tx,
      );
      await this.postPayoutReturn(failedPayout, tx);
      await this.recordPayoutEvent(failedPayout, DomainEventTypeEnum.PAYOUT_FAILED, tx);
    });

    this.fastify.log.warn(
      { payoutId: payout.id, failureCode: failure.failureCode },
      '[PayoutService] handlePayoutFailed() returned the money to the balance',
    );
  }

  private async postPayoutLeaving(payout: Payout, tx: DatabaseTransaction): Promise<void> {
    await this.fastify.ledgerService.postTransaction(
      {
        description: `Payout ${payout.id} left the processor balance`,
        currency: payout.currency,
        externalId: `payout:${payout.id}`,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.PAYOUTS_CLEARING,
            direction: PostingDirectionEnum.DEBIT,
            amount: payout.amount,
          },
          {
            accountCode: LedgerAccountCodeEnum.PSP_RECEIVABLE,
            direction: PostingDirectionEnum.CREDIT,
            amount: payout.amount,
          },
        ],
      },
      tx,
    );
  }

  private async postPayoutArrival(payout: Payout, tx: DatabaseTransaction): Promise<void> {
    await this.fastify.ledgerService.postTransaction(
      {
        description: `Payout ${payout.id} landed in the bank account`,
        currency: payout.currency,
        externalId: `payout_paid:${payout.id}`,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.CASH,
            direction: PostingDirectionEnum.DEBIT,
            amount: payout.amount,
          },
          {
            accountCode: LedgerAccountCodeEnum.PAYOUTS_CLEARING,
            direction: PostingDirectionEnum.CREDIT,
            amount: payout.amount,
          },
        ],
      },
      tx,
    );
  }

  private async postPayoutReturn(payout: Payout, tx: DatabaseTransaction): Promise<void> {
    await this.fastify.ledgerService.postTransaction(
      {
        description: `Payout ${payout.id} was refused by the bank`,
        currency: payout.currency,
        externalId: `payout_failed:${payout.id}`,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.PSP_RECEIVABLE,
            direction: PostingDirectionEnum.DEBIT,
            amount: payout.amount,
          },
          {
            accountCode: LedgerAccountCodeEnum.PAYOUTS_CLEARING,
            direction: PostingDirectionEnum.CREDIT,
            amount: payout.amount,
          },
        ],
      },
      tx,
    );
  }

  private async recordPayoutEvent(
    payout: Payout,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.PAYOUT,
          aggregateId: payout.id,
          eventType,
          payload: {
            id: payout.id,
            amount: payout.amount,
            currency: payout.currency,
            status: payout.status,
          },
        },
      ],
      tx,
    );
  }

  private async getProcessorPayout(pspReference: string): Promise<Payout> {
    const [payout] = await this.fastify.payoutRepository.findPayouts({ pspReference }, 1);

    if (payout) {
      return payout;
    }

    throw new NotFoundError(`No payout for processor reference ${pspReference}`);
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const payout = await this.fastify.payoutRepository.getPayout(id);

      return { createdAt: payout.createdAt, id: payout.id };
    }

    return undefined;
  }

  private static assertTransition(from: PayoutStatus, to: PayoutStatus): void {
    if (_.includes(PAYOUT_TRANSITIONS[from], to)) {
      return;
    }

    throw new ConflictError(`A payout cannot move from ${from} to ${to}`);
  }
}
