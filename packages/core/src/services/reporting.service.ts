import { MILLISECONDS_PER_DAY } from '@constants/time';
import { DiscountLevelEnum } from '@contracts/discounts.types';
import type {
  AggregateRevenueSummaryQuery,
  RevenueSummaryResponse,
} from '@contracts/reporting.types';
import type { Coupon, Discount } from '@database/schemas';
import type { RecurringCommitment } from '@repositories/reporting.repository';
import type { Currency } from '@utils/currency';
import { CurrencyEnum } from '@utils/currency';
import type { RoundingPolicy } from '@utils/money';
import { Money, RoundingPolicyEnum } from '@utils/money';
import { buildMonthlyAmount } from '@utils/recurring-amount';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const DEFAULT_WINDOW_DAYS = 30;
const MONTHS_PER_YEAR = 12;
const CHURN_PRECISION = 4;
const DISCOUNT_SCAN_LIMIT = 1_000;
const PERCENT_DIVISOR = 100;
const MRR_ROUNDING_POLICY: RoundingPolicy = RoundingPolicyEnum.HALF_UP;

interface MrrLine {
  subscriptionId: string;
  subscriptionItemId: string;
  customerId: string;
  productId: string;
  amount: number;
}

export class ReportingService {
  constructor(private readonly fastify: FastifyInstance) {}

  async aggregateRevenueSummary(
    query: AggregateRevenueSummaryQuery,
  ): Promise<RevenueSummaryResponse> {
    const currency = query.currency ?? CurrencyEnum.VND;
    const now = this.fastify.clock.now();
    const asOf = now.toISOString();
    const { windowStart, windowEnd } = ReportingService.resolveWindow(query, now);

    const commitments = await this.fastify.reportingRepository.findRecurringCommitments(currency);
    const mrr = await this.aggregateDiscountedMrr(commitments, currency, asOf);

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
      currency,
      asOf,
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
      windowStart,
      windowEnd,
    };
  }

  private static resolveWindow(
    query: AggregateRevenueSummaryQuery,
    now: Date,
  ): { windowStart: string; windowEnd: string } {
    const windowEnd = query.windowEnd ? new Date(query.windowEnd) : now;

    if (query.windowStart) {
      return {
        windowStart: new Date(query.windowStart).toISOString(),
        windowEnd: windowEnd.toISOString(),
      };
    }

    const windowStart = new Date(windowEnd.getTime() - DEFAULT_WINDOW_DAYS * MILLISECONDS_PER_DAY);

    return { windowStart: windowStart.toISOString(), windowEnd: windowEnd.toISOString() };
  }

  private async aggregateDiscountedMrr(
    commitments: readonly RecurringCommitment[],
    currency: Currency,
    activeAt: string,
  ): Promise<number> {
    const lines = _.map(commitments, (commitment): MrrLine => {
      return {
        subscriptionId: commitment.subscriptionId,
        subscriptionItemId: commitment.subscriptionItemId,
        customerId: commitment.customerId,
        productId: commitment.productId,
        amount: buildMonthlyAmount(
          commitment.unitAmount * commitment.quantity,
          commitment.interval,
          commitment.intervalCount,
        ),
      };
    });

    if (_.isEmpty(lines)) {
      return 0;
    }

    const discounts = await this.fastify.discountRepository.findDiscounts(
      { activeAt },
      DISCOUNT_SCAN_LIMIT,
    );

    if (_.isEmpty(discounts)) {
      return _.sumBy(lines, 'amount');
    }

    const couponById = await this.resolveCoupons(_.map(discounts, 'couponId'));

    for (const discount of discounts) {
      const coupon = couponById[discount.couponId];

      if (coupon && coupon.valid) {
        ReportingService.applyMrrDiscount(discount, coupon, lines, currency);
      }
    }

    return _.sumBy(lines, 'amount');
  }

  private static applyMrrDiscount(
    discount: Discount,
    coupon: Coupon,
    lines: MrrLine[],
    currency: Currency,
  ): void {
    if (coupon.amountOff !== null && coupon.currency !== currency) {
      return;
    }

    const eligibleIndexes = ReportingService.resolveEligibleIndexes(discount, coupon, lines);
    const weights = _.map(eligibleIndexes, (index) => {
      return _.get(lines, [index, 'amount'], 0);
    });
    const base = _.sum(weights);

    if (base <= 0) {
      return;
    }

    const { percentOff, amountOff } = coupon;
    const amount =
      percentOff === null
        ? Math.min(amountOff ?? 0, base)
        : Money.of(base, currency).multiply(percentOff / PERCENT_DIVISOR, MRR_ROUNDING_POLICY)
            .amount;

    if (amount <= 0) {
      return;
    }

    const shares = Money.of(amount, currency).allocate(weights);

    _.forEach(eligibleIndexes, (lineIndex, shareIndex) => {
      const line = lines[lineIndex];
      const share = shares[shareIndex];

      if (line && share) {
        line.amount -= share.amount;
      }
    });
  }

  private static resolveEligibleIndexes(
    discount: Discount,
    coupon: Coupon,
    lines: readonly MrrLine[],
  ): number[] {
    return _(lines)
      .map((line, index) => {
        return { line, index };
      })
      .filter(({ line }) => {
        if (line.amount <= 0) {
          return false;
        }

        if (discount.level === DiscountLevelEnum.SUBSCRIPTION_ITEM) {
          return line.subscriptionItemId === discount.subscriptionItemId;
        }

        if (discount.level === DiscountLevelEnum.SUBSCRIPTION) {
          return line.subscriptionId === discount.subscriptionId;
        }

        if (discount.level !== DiscountLevelEnum.CUSTOMER) {
          return false;
        }

        return (
          line.customerId === discount.customerId &&
          (_.isEmpty(coupon.appliesToProductIds) ||
            _.includes(coupon.appliesToProductIds, line.productId))
        );
      })
      .map('index')
      .value();
  }

  private async resolveCoupons(couponIds: readonly string[]): Promise<Record<string, Coupon>> {
    const ids = _.uniq([...couponIds]);
    const coupons = await this.fastify.couponRepository.findCoupons({ ids }, ids.length);

    return _.keyBy(coupons, 'id');
  }

  private static buildChurnRate(canceled: number, active: number): number {
    const exposed = canceled + active;

    if (exposed === 0) {
      return 0;
    }

    return _.round(canceled / exposed, CHURN_PRECISION);
  }
}
