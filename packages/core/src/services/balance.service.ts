import { MILLISECONDS_PER_DAY } from '@constants/time';
import type {
  BalanceAmount,
  BalanceResponse,
  BalanceTransactionResponse,
  FindBalanceTransactionsQuery,
} from '@contracts/balance.types';
import { BalanceSourceTypeEnum, BalanceTransactionTypeEnum } from '@contracts/balance.types';
import type { PostLedgerTransactionPayload } from '@contracts/ledger.types';
import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@contracts/ledger.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { BalanceTransaction, Charge, Dispute, Refund } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import type { Currency } from '@utils/currency';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const BALANCE_AVAILABILITY_DAYS = 2;
const ACCOUNT_SCAN_LIMIT = 100;

export class BalanceService {
  constructor(private readonly fastify: FastifyInstance) {}

  async getBalance(): Promise<BalanceResponse> {
    const asOf = this.fastify.clock.now().toISOString();
    const totals = await this.fastify.balanceTransactionRepository.aggregateBalanceTotals(asOf);
    const reserved = await this.resolveReservedAmounts();

    return {
      asOf,
      available: _.map(totals, (total): BalanceAmount => {
        return { currency: total.currency, amount: total.available };
      }),
      pending: _.map(totals, (total): BalanceAmount => {
        return { currency: total.currency, amount: total.pending };
      }),
      reserved,
    };
  }

  async getBalanceTransaction(id: string): Promise<BalanceTransactionResponse> {
    return this.fastify.balanceTransactionRepository.getBalanceTransaction(id);
  }

  async findBalanceTransactions(
    query: FindBalanceTransactionsQuery,
  ): Promise<ListResponse<BalanceTransactionResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.balanceTransactionRepository.findBalanceTransactions(
      { type: query.type, payoutId: query.payoutId, beforeAt, afterAt },
      limit + 1,
    );

    return {
      url: '/v1/balance_transactions',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  async recordChargeSettlement(
    charge: Charge,
    invoiceId: string | null,
    tx: DatabaseTransaction,
  ): Promise<BalanceTransaction> {
    const gross = charge.amountCaptured;
    const fee = Math.min(this.fastify.psp.calculateProcessingFee(gross), gross);
    const net = gross - fee;
    const settlementEntries: PostLedgerTransactionPayload['entries'] = [
      {
        accountCode: LedgerAccountCodeEnum.PSP_RECEIVABLE,
        direction: PostingDirectionEnum.DEBIT,
        amount: net,
      },
      {
        accountCode: LedgerAccountCodeEnum.PSP_FEES,
        direction: PostingDirectionEnum.DEBIT,
        amount: fee,
      },
      invoiceId
        ? {
            accountCode: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
            customerId: charge.customerId,
            direction: PostingDirectionEnum.CREDIT,
            amount: gross,
          }
        : {
            accountCode: LedgerAccountCodeEnum.REVENUE,
            direction: PostingDirectionEnum.CREDIT,
            amount: gross,
          },
    ];

    await this.fastify.ledgerService.postTransaction(
      {
        description: `Charge ${charge.id} settled by the processor`,
        currency: charge.currency,
        externalId: `charge:${charge.id}`,
        entries: _.filter(settlementEntries, (entry) => {
          return entry.amount > 0;
        }),
      },
      tx,
    );

    return this.createBalanceTransaction(
      {
        type: BalanceTransactionTypeEnum.CHARGE,
        currency: charge.currency,
        gross,
        fee,
        net,
        sourceType: BalanceSourceTypeEnum.CHARGE,
        sourceId: charge.id,
        createdAt: charge.createdAt,
      },
      tx,
    );
  }

  async recordRefundSettlement(
    refund: Refund,
    tx: DatabaseTransaction,
  ): Promise<BalanceTransaction> {
    await this.fastify.ledgerService.postTransaction(
      {
        description: `Refund ${refund.id} returned to the cardholder`,
        currency: refund.currency,
        externalId: `refund:${refund.id}`,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.REVENUE,
            direction: PostingDirectionEnum.DEBIT,
            amount: refund.amount,
          },
          {
            accountCode: LedgerAccountCodeEnum.PSP_RECEIVABLE,
            direction: PostingDirectionEnum.CREDIT,
            amount: refund.amount,
          },
        ],
      },
      tx,
    );

    return this.createBalanceTransaction(
      {
        type: BalanceTransactionTypeEnum.REFUND,
        currency: refund.currency,
        gross: -refund.amount,
        fee: 0,
        net: -refund.amount,
        sourceType: BalanceSourceTypeEnum.REFUND,
        sourceId: refund.id,
        createdAt: this.fastify.clock.now().toISOString(),
      },
      tx,
    );
  }

  async recordDisputeHold(dispute: Dispute, tx: DatabaseTransaction): Promise<BalanceTransaction> {
    await this.fastify.ledgerService.postTransaction(
      {
        description: `Dispute ${dispute.id} withheld by the processor`,
        currency: dispute.currency,
        externalId: `dispute:${dispute.id}`,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.DISPUTES_HELD,
            direction: PostingDirectionEnum.DEBIT,
            amount: dispute.amount,
          },
          {
            accountCode: LedgerAccountCodeEnum.PSP_RECEIVABLE,
            direction: PostingDirectionEnum.CREDIT,
            amount: dispute.amount,
          },
        ],
      },
      tx,
    );

    return this.createBalanceTransaction(
      {
        type: BalanceTransactionTypeEnum.DISPUTE,
        currency: dispute.currency,
        gross: -dispute.amount,
        fee: 0,
        net: -dispute.amount,
        sourceType: BalanceSourceTypeEnum.DISPUTE,
        sourceId: dispute.id,
        createdAt: this.fastify.clock.now().toISOString(),
      },
      tx,
    );
  }

  async recordDisputeReversal(
    dispute: Dispute,
    tx: DatabaseTransaction,
  ): Promise<BalanceTransaction> {
    await this.fastify.ledgerService.postTransaction(
      {
        description: `Dispute ${dispute.id} released back to the balance`,
        currency: dispute.currency,
        externalId: `dispute_reversal:${dispute.id}`,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.PSP_RECEIVABLE,
            direction: PostingDirectionEnum.DEBIT,
            amount: dispute.amount,
          },
          {
            accountCode: LedgerAccountCodeEnum.DISPUTES_HELD,
            direction: PostingDirectionEnum.CREDIT,
            amount: dispute.amount,
          },
        ],
      },
      tx,
    );

    return this.createBalanceTransaction(
      {
        type: BalanceTransactionTypeEnum.DISPUTE_REVERSAL,
        currency: dispute.currency,
        gross: dispute.amount,
        fee: 0,
        net: dispute.amount,
        sourceType: BalanceSourceTypeEnum.DISPUTE,
        sourceId: dispute.id,
        createdAt: this.fastify.clock.now().toISOString(),
      },
      tx,
    );
  }

  async recordDisputeLoss(dispute: Dispute, tx: DatabaseTransaction): Promise<void> {
    await this.fastify.ledgerService.postTransaction(
      {
        description: `Dispute ${dispute.id} lost`,
        currency: dispute.currency,
        externalId: `dispute_loss:${dispute.id}`,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.REVENUE,
            direction: PostingDirectionEnum.DEBIT,
            amount: dispute.amount,
          },
          {
            accountCode: LedgerAccountCodeEnum.DISPUTES_HELD,
            direction: PostingDirectionEnum.CREDIT,
            amount: dispute.amount,
          },
        ],
      },
      tx,
    );
  }

  private async createBalanceTransaction(
    payload: {
      type: BalanceTransactionTypeEnum;
      currency: Currency;
      gross: number;
      fee: number;
      net: number;
      sourceType: BalanceSourceTypeEnum;
      sourceId: string;
      createdAt: string;
    },
    tx: DatabaseTransaction,
  ): Promise<BalanceTransaction> {
    const id = generateGid(ObjectPrefixEnum.BALANCE_TRANSACTION);

    const balanceTransaction =
      await this.fastify.balanceTransactionRepository.createBalanceTransaction(
        {
          id,
          type: payload.type,
          currency: payload.currency,
          gross: payload.gross,
          fee: payload.fee,
          net: payload.net,
          availableOn: BalanceService.resolveAvailableOn(payload.createdAt),
          sourceType: payload.sourceType,
          sourceId: payload.sourceId,
          payoutId: null,
          createdAt: payload.createdAt,
        },
        tx,
      );

    if (balanceTransaction) {
      return balanceTransaction;
    }

    throw new NotFoundError(`Balance transaction ${id} could not be created`);
  }

  private async resolveReservedAmounts(): Promise<BalanceAmount[]> {
    const accounts = await this.fastify.ledgerAccountRepository.findLedgerAccounts(
      { code: LedgerAccountCodeEnum.DISPUTES_HELD },
      ACCOUNT_SCAN_LIMIT,
    );

    return _.map(accounts, (account): BalanceAmount => {
      return { currency: account.currency, amount: account.balance };
    });
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const balanceTransaction =
        await this.fastify.balanceTransactionRepository.getBalanceTransaction(id);

      return { createdAt: balanceTransaction.createdAt, id: balanceTransaction.id };
    }

    return undefined;
  }

  private static resolveAvailableOn(createdAt: string): string {
    const createdAtMs = new Date(createdAt).getTime();

    return new Date(createdAtMs + BALANCE_AVAILABILITY_DAYS * MILLISECONDS_PER_DAY).toISOString();
  }
}
