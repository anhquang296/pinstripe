import { MAX_ITEMS_PER_SUBSCRIPTION } from '@constants/subscription';
import { UsageTypeEnum } from '@contracts/prices.types';
import type { RatedInvoiceResponse } from '@contracts/rating.types';
import { BillingModeEnum } from '@contracts/subscriptions.types';
import type { Price, Subscription, SubscriptionItemChange } from '@database/schemas';
import { advancePeriod, regressPeriod } from '@utils/billing-period';
import type {
  BillingWindow,
  LineItemType,
  RatedLineItem,
  RatingLine,
  RatingPrice,
} from '@utils/rating';
import {
  LineItemTypeEnum,
  rateLines,
  resolveBillingWindow,
  resolveCreditWindow,
} from '@utils/rating';
import type { SubscriptionInterval } from '@utils/subscription-price';
import { resolveInterval } from '@utils/subscription-price';
import type { DatabaseTransaction } from '@vxrerp/platform/database';
import { BadRequestError, NotFoundError } from '@vxrerp/platform/errors';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export interface RatingPeriod {
  periodStart: Date;
  periodEnd: Date;
}

export class RatingService {
  constructor(private readonly fastify: FastifyInstance) {}

  async rateUpcomingInvoice(subscriptionId: string): Promise<RatedInvoiceResponse> {
    const subscription = await this.fastify.subscriptionRepository.getSubscription(subscriptionId);

    const { periodStart, periodEnd } = RatingService.readCurrentPeriod(subscription);

    if (subscription.billingMode === BillingModeEnum.ARREARS) {
      return this.rateInvoicePeriod(subscriptionId, periodStart, periodEnd);
    }

    const { interval, intervalCount } = await this.resolveSubscriptionInterval(subscriptionId);

    const nextPeriodStart = periodEnd;

    return this.rateInvoicePeriod(
      subscriptionId,
      nextPeriodStart,
      advancePeriod(nextPeriodStart, interval, intervalCount),
    );
  }

  async rateInvoicePeriod(
    subscriptionId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RatedInvoiceResponse> {
    const subscription = await this.fastify.subscriptionRepository.getSubscription(subscriptionId);
    const period: RatingPeriod = { periodStart, periodEnd };

    if (subscription.billingMode === BillingModeEnum.ADVANCE) {
      return this.rateAdvancePeriod(subscription, period);
    }

    const changes = await this.findPeriodChanges(subscriptionId, period);

    return this.rateSubscriptionItemChanges(subscription, changes, period);
  }

  async rateProrationInvoice(
    subscriptionId: string,
    executor?: DatabaseTransaction,
  ): Promise<RatedInvoiceResponse> {
    const subscription = await this.fastify.subscriptionRepository.getSubscription(subscriptionId);
    const period = RatingService.readCurrentPeriod(subscription);

    if (subscription.billingMode === BillingModeEnum.ADVANCE) {
      const changes = await this.findPeriodChanges(subscriptionId, period, executor);
      const lines = await this.buildTrailingLines(subscription, changes, period);

      return RatingService.assembleRatedInvoice(subscription, lines, period);
    }

    const changes = await this.fastify.subscriptionRepository.findSubscriptionItemChanges(
      {
        subscriptionIds: [subscriptionId],
        billedThroughIsNull: false,
        billedFromBeforeAt: period.periodEnd.toISOString(),
        billedThroughAfterAt: period.periodStart.toISOString(),
      },
      executor,
    );

    return this.rateSubscriptionItemChanges(subscription, changes, period);
  }

  private async rateAdvancePeriod(
    subscription: Subscription,
    period: RatingPeriod,
  ): Promise<RatedInvoiceResponse> {
    const { interval, intervalCount } = await this.resolveSubscriptionInterval(subscription.id);

    const trailingPeriod: RatingPeriod = {
      periodStart: regressPeriod(period.periodStart, interval, intervalCount),
      periodEnd: period.periodStart,
    };

    const trailingChanges = await this.findPeriodChanges(subscription.id, trailingPeriod);

    const trailingLines = await this.buildTrailingLines(
      subscription,
      trailingChanges,
      trailingPeriod,
    );

    const upfrontChanges = await this.findPeriodChanges(subscription.id, period);
    const upfrontLines = await this.buildUpfrontLines(upfrontChanges, period);

    return RatingService.assembleRatedInvoice(
      subscription,
      [...trailingLines, ...upfrontLines],
      period,
    );
  }

  private async buildUpfrontLines(
    changes: readonly SubscriptionItemChange[],
    period: RatingPeriod,
  ): Promise<RatingLine[]> {
    const priceById = await this.resolvePrices(_.map(changes, 'priceId'));
    const lines: RatingLine[] = [];

    for (const change of changes) {
      const price = RatingService.readPrice(priceById, change.priceId);

      if (price.usageType !== UsageTypeEnum.METERED) {
        const window = RatingService.resolveChangeWindow(change, period);

        if (window) {
          lines.push(RatingService.buildLicensedLine(change, price, window, period, false));
        }
      }
    }

    return lines;
  }

  private async buildTrailingLines(
    subscription: Subscription,
    changes: readonly SubscriptionItemChange[],
    period: RatingPeriod,
  ): Promise<RatingLine[]> {
    const priceById = await this.resolvePrices(_.map(changes, 'priceId'));
    const lines: RatingLine[] = [];

    for (const change of changes) {
      const price = RatingService.readPrice(priceById, change.priceId);
      const window = RatingService.resolveChangeWindow(change, period);

      if (price.usageType === UsageTypeEnum.METERED) {
        if (window) {
          lines.push(await this.buildMeteredLine(subscription, change, price, window, period));
        }

        continue;
      }

      if (window) {
        lines.push(RatingService.buildLicensedLine(change, price, window, period, false));
      }

      const creditWindow = resolveCreditWindow(
        RatingService.resolveInstant(change.billedThrough),
        RatingService.resolveInstant(change.invoicedThrough),
        period.periodStart,
        period.periodEnd,
      );

      if (creditWindow) {
        lines.push(RatingService.buildLicensedLine(change, price, creditWindow, period, true));
      }
    }

    return lines;
  }

  private async findPeriodChanges(
    subscriptionId: string,
    period: RatingPeriod,
    executor?: DatabaseTransaction,
  ): Promise<SubscriptionItemChange[]> {
    return this.fastify.subscriptionRepository.findSubscriptionItemChanges(
      {
        subscriptionIds: [subscriptionId],
        billedFromBeforeAt: period.periodEnd.toISOString(),
        billedThroughAfterAt: period.periodStart.toISOString(),
      },
      executor,
    );
  }

  private async resolveSubscriptionInterval(subscriptionId: string): Promise<SubscriptionInterval> {
    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: [subscriptionId],
    });

    const prices = await this.fastify.priceRepository.findPrices(
      { ids: _.uniq(_.map(subscriptionItems, 'priceId')) },
      MAX_ITEMS_PER_SUBSCRIPTION,
    );

    return resolveInterval(prices);
  }

  private async rateSubscriptionItemChanges(
    subscription: Subscription,
    changes: readonly SubscriptionItemChange[],
    period: RatingPeriod,
  ): Promise<RatedInvoiceResponse> {
    const lines = await this.buildLines(subscription, changes, period);

    return RatingService.assembleRatedInvoice(subscription, lines, period);
  }

  private static assembleRatedInvoice(
    subscription: Subscription,
    lines: readonly RatingLine[],
    period: RatingPeriod,
  ): RatedInvoiceResponse {
    const { lineItems, total } = rateLines(lines, subscription.currency);

    return {
      subscriptionId: subscription.id,
      customerId: subscription.customerId,
      currency: subscription.currency,
      periodStart: period.periodStart.toISOString(),
      periodEnd: period.periodEnd.toISOString(),
      total: total.amount,
      lineItems: _.map(lineItems, RatingService.buildLineItem),
    };
  }

  private async buildLines(
    subscription: Subscription,
    changes: readonly SubscriptionItemChange[],
    period: RatingPeriod,
  ): Promise<RatingLine[]> {
    const priceById = await this.resolvePrices(_.map(changes, 'priceId'));
    const lines: RatingLine[] = [];

    for (const change of changes) {
      const price = RatingService.readPrice(priceById, change.priceId);
      const window = RatingService.resolveChangeWindow(change, period);

      if (window) {
        if (price.usageType === UsageTypeEnum.METERED) {
          lines.push(await this.buildMeteredLine(subscription, change, price, window, period));

          continue;
        }

        lines.push(RatingService.buildLicensedLine(change, price, window, period, false));
      }
    }

    return lines;
  }

  private async buildMeteredLine(
    subscription: Subscription,
    change: SubscriptionItemChange,
    price: Price,
    window: BillingWindow,
    period: RatingPeriod,
  ): Promise<RatingLine> {
    const quantity = await this.resolveUsage(subscription, price, window.start, window.end);

    return {
      subscriptionItemId: change.subscriptionItemId,
      subscriptionItemChangeId: change.id,
      price: RatingService.buildRatingPrice(price),
      type: LineItemTypeEnum.USAGE,
      quantity,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      usageStart: null,
      usageEnd: null,
      isCredit: false,
    };
  }

  private static buildLicensedLine(
    change: SubscriptionItemChange,
    price: Price,
    window: BillingWindow,
    period: RatingPeriod,
    isCredit: boolean,
  ): RatingLine {
    const usageStart = window.isPartial ? window.start : null;
    const usageEnd = window.isPartial ? window.end : null;

    return {
      subscriptionItemId: change.subscriptionItemId,
      subscriptionItemChangeId: change.id,
      price: RatingService.buildRatingPrice(price),
      type: RatingService.resolveLineItemType(window.isPartial),
      quantity: change.quantity,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      usageStart,
      usageEnd,
      isCredit,
    };
  }

  private async resolveUsage(
    subscription: Subscription,
    price: Price,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<number> {
    const meterId = price.meterId;

    if (meterId) {
      const summary = await this.fastify.meterEventService.getMeterEventSummary(meterId, {
        customerId: subscription.customerId,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
      });

      return summary.value;
    }

    throw new BadRequestError(`Metered price ${price.id} is not attached to a meter`);
  }

  private async resolvePrices(priceIds: readonly string[]): Promise<Record<string, Price>> {
    const ids = _.uniq([...priceIds]);

    if (_.isEmpty(ids)) {
      return {};
    }

    const rows = await this.fastify.priceRepository.findPrices({ ids }, ids.length);

    return _.keyBy(rows, 'id');
  }

  private static readPrice(priceById: Record<string, Price>, priceId: string): Price {
    const price = priceById[priceId];

    if (price) {
      return price;
    }

    throw new NotFoundError(`No such price: ${priceId}`);
  }

  private static readCurrentPeriod(subscription: Subscription): RatingPeriod {
    return {
      periodStart: new Date(subscription.currentPeriodStart),
      periodEnd: new Date(subscription.currentPeriodEnd),
    };
  }

  private static resolveChangeWindow(
    change: SubscriptionItemChange,
    period: RatingPeriod,
  ): BillingWindow | null {
    return resolveBillingWindow(
      new Date(change.billedFrom),
      RatingService.resolveInstant(change.billedThrough),
      RatingService.resolveInstant(change.invoicedThrough),
      period.periodStart,
      period.periodEnd,
    );
  }

  private static resolveInstant(instant: string | null): Date | null {
    if (instant) {
      return new Date(instant);
    }

    return null;
  }

  private static resolveLineItemType(isPartial: boolean): LineItemType {
    if (isPartial) {
      return LineItemTypeEnum.PRORATION;
    }

    return LineItemTypeEnum.SUBSCRIPTION;
  }

  private static buildRatingPrice(price: Price): RatingPrice {
    return {
      id: price.id,
      currency: price.currency,
      billingScheme: price.billingScheme,
      unitAmount: price.unitAmount,
      tiersMode: price.tiersMode,
      tiers: price.tiers,
      transformQuantity: price.transformQuantity,
    };
  }

  private static buildLineItem(lineItem: RatedLineItem): RatedInvoiceResponse['lineItems'][number] {
    return {
      subscriptionItemId: lineItem.subscriptionItemId,
      subscriptionItemChangeId: lineItem.subscriptionItemChangeId,
      priceId: lineItem.priceId,
      type: lineItem.type,
      quantity: lineItem.quantity,
      ratedQuantity: lineItem.ratedQuantity,
      amount: lineItem.amount.amount,
      periodStart: lineItem.periodStart.toISOString(),
      periodEnd: lineItem.periodEnd.toISOString(),
      prorationFactor: lineItem.prorationFactor,
      isCredit: lineItem.isCredit,
    };
  }
}
