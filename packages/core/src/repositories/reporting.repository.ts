import { InvoiceStatusEnum } from '@contracts/invoices.types';
import type { LedgerAccountCode } from '@contracts/ledger.types';
import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@contracts/ledger.types';
import type { RecurringInterval } from '@contracts/prices.types';
import { SubscriptionStatusEnum } from '@contracts/subscriptions.types';
import type { DatabaseClient } from '@database/database.client';
import {
  invoicePayments,
  invoices,
  ledgerAccounts,
  ledgerPostings,
  ledgerTransactions,
  prices,
  refunds,
  subscriptionItems,
  subscriptions,
} from '@database/schemas';
import type { Currency } from '@utils/currency';
import { and, count, eq, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface RecurringCommitment {
  subscriptionId: string;
  subscriptionItemId: string;
  customerId: string;
  productId: string;
  unitAmount: number;
  quantity: number;
  interval: RecurringInterval;
  intervalCount: number;
}

export interface SubscriptionCounts {
  active: number;
  trialing: number;
}

export interface InvoiceWindowTotals {
  invoiced: number;
  outstanding: number;
}

export interface LedgerMovement {
  externalId: string;
  amount: number;
}

export interface InvoiceSettlement {
  chargeId: string;
  amount: number;
}

export class ReportingRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findRecurringCommitments(currency: Currency): Promise<RecurringCommitment[]> {
    return this._db.master
      .select({
        subscriptionId: subscriptions.id,
        subscriptionItemId: subscriptionItems.id,
        customerId: subscriptions.customerId,
        productId: prices.productId,
        unitAmount: sql<number>`coalesce(${prices.unitAmount}, 0)::int`,
        quantity: subscriptionItems.quantity,
        interval: sql<RecurringInterval>`${prices.recurringInterval}`,
        intervalCount: sql<number>`coalesce(${prices.recurringIntervalCount}, 1)::int`,
      })
      .from(subscriptionItems)
      .innerJoin(subscriptions, eq(subscriptions.id, subscriptionItems.subscriptionId))
      .innerJoin(prices, eq(prices.id, subscriptionItems.priceId))
      .where(
        and(
          eq(subscriptions.status, SubscriptionStatusEnum.ACTIVE),
          eq(subscriptions.currency, currency),
          isNotNull(prices.recurringInterval),
        ),
      );
  }

  async countSubscriptions(currency: Currency): Promise<SubscriptionCounts> {
    const rows = await this._db.master
      .select({ status: subscriptions.status, total: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.currency, currency),
          inArray(subscriptions.status, [
            SubscriptionStatusEnum.ACTIVE,
            SubscriptionStatusEnum.TRIALING,
          ]),
        ),
      )
      .groupBy(subscriptions.status);

    const totalByStatus = _.mapValues(_.keyBy(rows, 'status'), 'total');

    const {
      [SubscriptionStatusEnum.ACTIVE]: active = 0,
      [SubscriptionStatusEnum.TRIALING]: trialing = 0,
    } = totalByStatus;

    return { active, trialing };
  }

  async countCanceledSubscriptions(
    currency: Currency,
    windowStart: string,
    windowEnd: string,
  ): Promise<number> {
    const [row] = await this._db.master
      .select({ total: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.currency, currency),
          eq(subscriptions.status, SubscriptionStatusEnum.CANCELED),
          gte(subscriptions.canceledAt, windowStart),
          lt(subscriptions.canceledAt, windowEnd),
        ),
      );

    return _.get(row, 'total', 0);
  }

  async aggregateInvoiceTotals(
    currency: Currency,
    windowStart: string,
    windowEnd: string,
  ): Promise<InvoiceWindowTotals> {
    const [row] = await this._db.master
      .select({
        invoiced: sql<number>`coalesce(sum(${invoices.total}), 0)::int`,
        outstanding: sql<number>`coalesce(sum(case when ${invoices.status} = ${InvoiceStatusEnum.OPEN} then ${invoices.amountDue} - ${invoices.amountPaid} else 0 end), 0)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.currency, currency),
          isNotNull(invoices.finalizedAt),
          gte(invoices.finalizedAt, windowStart),
          lt(invoices.finalizedAt, windowEnd),
        ),
      );

    return { invoiced: _.get(row, 'invoiced', 0), outstanding: _.get(row, 'outstanding', 0) };
  }

  async aggregateRefundTotal(
    currency: Currency,
    windowStart: string,
    windowEnd: string,
  ): Promise<number> {
    const [row] = await this._db.master
      .select({ total: sql<number>`coalesce(sum(${refunds.amount}), 0)::int` })
      .from(refunds)
      .where(
        and(
          eq(refunds.currency, currency),
          gte(refunds.createdAt, windowStart),
          lt(refunds.createdAt, windowEnd),
        ),
      );

    return _.get(row, 'total', 0);
  }

  async aggregateCashMovement(
    currency: Currency,
    windowStart: string,
    windowEnd: string,
  ): Promise<number> {
    const [row] = await this._db.master
      .select({
        total: sql<number>`coalesce(sum(case when ${ledgerPostings.direction} = ${PostingDirectionEnum.DEBIT} then ${ledgerPostings.amount} else -${ledgerPostings.amount} end), 0)::int`,
      })
      .from(ledgerPostings)
      .innerJoin(ledgerAccounts, eq(ledgerAccounts.id, ledgerPostings.accountId))
      .innerJoin(ledgerTransactions, eq(ledgerTransactions.id, ledgerPostings.transactionId))
      .where(
        and(
          eq(ledgerAccounts.code, LedgerAccountCodeEnum.CASH),
          eq(ledgerAccounts.currency, currency),
          gte(ledgerTransactions.effectiveAt, windowStart),
          lt(ledgerTransactions.effectiveAt, windowEnd),
        ),
      );

    return _.get(row, 'total', 0);
  }

  async aggregateLedgerMovements(
    codes: readonly LedgerAccountCode[],
    windowStart: string,
    windowEnd: string,
  ): Promise<LedgerMovement[]> {
    return this._db.master
      .select({
        externalId: sql<string>`${ledgerTransactions.externalId}`,
        amount: sql<number>`coalesce(sum(case when ${ledgerPostings.direction} = ${PostingDirectionEnum.DEBIT} then ${ledgerPostings.amount} else -${ledgerPostings.amount} end), 0)::int`,
      })
      .from(ledgerPostings)
      .innerJoin(ledgerAccounts, eq(ledgerAccounts.id, ledgerPostings.accountId))
      .innerJoin(ledgerTransactions, eq(ledgerTransactions.id, ledgerPostings.transactionId))
      .where(
        and(
          inArray(ledgerAccounts.code, [...codes]),
          isNotNull(ledgerTransactions.externalId),
          gte(ledgerTransactions.effectiveAt, windowStart),
          lt(ledgerTransactions.effectiveAt, windowEnd),
        ),
      )
      .groupBy(ledgerTransactions.externalId);
  }

  async aggregateInvoiceSettlements(chargeIds: readonly string[]): Promise<InvoiceSettlement[]> {
    if (_.isEmpty(chargeIds)) {
      return [];
    }

    return this._db.master
      .select({
        chargeId: sql<string>`${invoicePayments.chargeId}`,
        amount: sql<number>`coalesce(sum(${invoicePayments.amount}), 0)::int`,
      })
      .from(invoicePayments)
      .where(inArray(invoicePayments.chargeId, [...chargeIds]))
      .groupBy(invoicePayments.chargeId);
  }
}
