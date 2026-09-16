import { MILLISECONDS_PER_DAY } from '@constants/time';
import type { GetRevenueSummaryQuery, RevenueSummaryResponse } from '@contracts/reporting.types';
import { CurrencyEnum } from '@utils/currency';
import { buildMonthlyAmount } from '@utils/recurring-amount';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const DEFAULT_WINDOW_DAYS = 30;
const MONTHS_PER_YEAR = 12;
const CHURN_PRECISION = 4;

export class ReportingService {
  constructor(private readonly fastify: FastifyInstance) {}

  async getRevenueSummary(query: GetRevenueSummaryQuery): Promise<RevenueSummaryResponse> {
    const currency = query.currency ?? CurrencyEnum.VND;
    const now = this.fastify.clock.now();
    const windowEnd = query.windowEnd ? new Date(query.windowEnd) : now;
    const windowStart = query.windowStart
      ? new Date(query.windowStart)
      : new Date(windowEnd.getTime() - DEFAULT_WINDOW_DAYS * MILLISECONDS_PER_DAY);

    const commitments = await this.fastify.reportingRepository.findRecurringCommitments(currency);
    const mrr = _.sumBy(commitments, (commitment) => {
      return buildMonthlyAmount(
        commitment.unitAmount * commitment.quantity,
        commitment.interval,
        commitment.intervalCount,
      );
    });

    const counts = await this.fastify.reportingRepository.countSubscriptions(currency);
    const canceledInWindow = await this.fastify.reportingRepository.countCanceledSubscriptions(
      currency,
      windowStart,
      windowEnd,
    );
    const invoiceTotals = await this.fastify.reportingRepository.aggregateInvoiceTotals(
      currency,
      windowStart,
      windowEnd,
    );
    const refundedInWindow = await this.fastify.reportingRepository.aggregateRefundTotal(
      currency,
      windowStart,
      windowEnd,
    );
    const collectedInWindow = await this.fastify.reportingRepository.aggregateCashMovement(
      currency,
      windowStart,
      windowEnd,
    );

    return {
      object: 'revenue_summary',
      currency,
      asOf: now.toISOString(),
      mrr,
      arr: mrr * MONTHS_PER_YEAR,
      activeSubscriptions: counts.active,
      trialingSubscriptions: counts.trialing,
      canceledInWindow,
      churnRate: ReportingService.buildChurnRate(canceledInWindow, counts.active),
      invoicedInWindow: invoiceTotals.invoiced,
      collectedInWindow,
      refundedInWindow,
      outstanding: invoiceTotals.outstanding,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    };
  }

  private static buildChurnRate(canceled: number, active: number): number {
    const exposed = canceled + active;

    if (exposed === 0) {
      return 0;
    }

    return _.round(canceled / exposed, CHURN_PRECISION);
  }
}
