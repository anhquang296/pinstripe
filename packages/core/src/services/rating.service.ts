import { UsageTypeEnum } from '@contracts/prices.types';
import type { RatedInvoiceResponse } from '@contracts/rating.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { Price, Subscription, SubscriptionItemChange } from '@database/schemas';
import { BadRequestError, NotFoundError } from '@errors/app.error';
import type {
  BillingWindow,
  LineItemType,
  RatedLineItem,
  RatingLine,
  RatingPrice,
} from '@utils/rating';
import { LineItemTypeEnum, rateLines, resolveBillingWindow } from '@utils/rating';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export interface RatingPeriod {
  periodStart: Date;
  periodEnd: Date;
}

export class RatingService {
  constructor(private readonly fastify: FastifyInstance) {}

  async rateUpcomingInvoice(subscriptionId: string): Promise<RatedInvoiceResponse> {
    const subscription = await this.getSubscription(subscriptionId);

    return this.rateInvoicePeriod(
      subscriptionId,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
    );
  }

  async rateInvoicePeriod(
    subscriptionId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RatedInvoiceResponse> {
    const subscription = await this.getSubscription(subscriptionId);
    const changes = await this.fastify.subscriptionRepository.findSubscriptionItemChanges({
      subscriptionIds: [subscriptionId],
      billedFromBeforeAt: periodEnd,
      billedThroughAfterAt: periodStart,
    });

    return this.rateSubscriptionItemChanges(subscription, changes, { periodStart, periodEnd });
  }

  async rateProrationInvoice(
    subscriptionId: string,
    executor?: DatabaseTransaction,
  ): Promise<RatedInvoiceResponse> {
    const subscription = await this.getSubscription(subscriptionId);
    const changes = await this.fastify.subscriptionRepository.findSubscriptionItemChanges(
      {
        subscriptionIds: [subscriptionId],
        billedThroughIsNull: false,
        billedFromBeforeAt: subscription.currentPeriodEnd,
        billedThroughAfterAt: subscription.currentPeriodStart,
      },
      executor,
    );

    return this.rateSubscriptionItemChanges(subscription, changes, {
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
    });
  }

  private async getSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.fastify.subscriptionRepository.findSubscription(subscriptionId);

    if (subscription) {
      return subscription;
    }

    throw new NotFoundError(`No such subscription: ${subscriptionId}`);
  }

  private async rateSubscriptionItemChanges(
    subscription: Subscription,
    changes: readonly SubscriptionItemChange[],
    period: RatingPeriod,
  ): Promise<RatedInvoiceResponse> {
    const priceById = await this.resolvePrices(_.map(changes, 'priceId'));
    const lines = await this.buildLines(subscription, changes, priceById, period);
    const { lineItems, total } = rateLines(lines, subscription.currency);

    return {
      object: 'rated_invoice',
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
    priceById: Record<string, Price>,
    period: RatingPeriod,
  ): Promise<RatingLine[]> {
    const lines: RatingLine[] = [];

    for (const change of changes) {
      const price = priceById[change.priceId];

      if (!price) {
        throw new NotFoundError(`No such price: ${change.priceId}`);
      }

      const window = resolveBillingWindow(
        change.billedFrom,
        change.billedThrough,
        change.invoicedThrough,
        period.periodStart,
        period.periodEnd,
      );

      if (window) {
        const line = await this.buildLine(subscription, change, price, window, period);

        lines.push(line);
      }
    }

    return lines;
  }

  private async buildLine(
    subscription: Subscription,
    change: SubscriptionItemChange,
    price: Price,
    window: BillingWindow,
    period: RatingPeriod,
  ): Promise<RatingLine> {
    const isMetered = price.usageType === UsageTypeEnum.METERED;
    const quantity = isMetered
      ? await this.resolveUsage(subscription, price, window.start, window.end)
      : change.quantity;

    return {
      subscriptionItemId: change.subscriptionItemId,
      subscriptionItemChangeId: change.id,
      price: RatingService.buildRatingPrice(price),
      type: RatingService.resolveLineItemType(isMetered, window.isPartial),
      quantity,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      usageStart: window.isPartial && !isMetered ? window.start : null,
      usageEnd: window.isPartial && !isMetered ? window.end : null,
      isCredit: false,
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
      const summary = await this.fastify.meterEventService.getMeterEventSummary(
        meterId,
        {
          customerId: subscription.customerId,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
        },
        subscription.livemode,
      );

      return summary.value;
    }

    throw new BadRequestError(`Metered price ${price.id} is not attached to a meter`);
  }

  private async resolvePrices(priceIds: readonly string[]): Promise<Record<string, Price>> {
    const rows = await this.fastify.priceRepository.findPrices(
      { ids: _.uniq(priceIds) },
      priceIds.length,
    );

    return _.keyBy(rows, 'id');
  }

  private static resolveLineItemType(isMetered: boolean, isPartial: boolean): LineItemType {
    if (isMetered) {
      return LineItemTypeEnum.USAGE;
    }

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
      object: 'rated_line_item',
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
    };
  }
}
