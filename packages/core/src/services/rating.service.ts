import { UsageTypeEnum } from '@contracts/prices.types';
import type { RatedInvoiceResponse } from '@contracts/rating.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { Price, Subscription, SubscriptionItem } from '@database/schemas';
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

export class RatingService {
  constructor(private readonly fastify: FastifyInstance) {}

  async rateUpcomingInvoice(subscriptionId: string): Promise<RatedInvoiceResponse> {
    const subscription = await this.getSubscription(subscriptionId);
    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: [subscriptionId],
      billedFromBeforeAt: subscription.currentPeriodEnd,
      billedThroughAfterAt: subscription.currentPeriodStart,
    });

    return this.rateSubscriptionItems(subscription, subscriptionItems);
  }

  async rateProrationInvoice(
    subscriptionId: string,
    executor?: DatabaseTransaction,
  ): Promise<RatedInvoiceResponse> {
    const subscription = await this.getSubscription(subscriptionId);
    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems(
      {
        subscriptionIds: [subscriptionId],
        deletedAtIsNull: false,
        billedFromBeforeAt: subscription.currentPeriodEnd,
        billedThroughAfterAt: subscription.currentPeriodStart,
      },
      executor,
    );

    return this.rateSubscriptionItems(subscription, subscriptionItems);
  }

  private async getSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.fastify.subscriptionRepository.findSubscription(subscriptionId);

    if (subscription) {
      return subscription;
    }

    throw new NotFoundError(`No such subscription: ${subscriptionId}`);
  }

  private async rateSubscriptionItems(
    subscription: Subscription,
    subscriptionItems: readonly SubscriptionItem[],
  ): Promise<RatedInvoiceResponse> {
    const priceById = await this.resolvePrices(_.map(subscriptionItems, 'priceId'));
    const lines = await this.buildLines(subscription, subscriptionItems, priceById);
    const { lineItems, total } = rateLines(lines, subscription.currency);

    return {
      object: 'rated_invoice',
      subscriptionId: subscription.id,
      customerId: subscription.customerId,
      currency: subscription.currency,
      periodStart: subscription.currentPeriodStart.toISOString(),
      periodEnd: subscription.currentPeriodEnd.toISOString(),
      total: total.amount,
      lineItems: _.map(lineItems, RatingService.buildLineItem),
    };
  }

  private async buildLines(
    subscription: Subscription,
    subscriptionItems: readonly SubscriptionItem[],
    priceById: Record<string, Price>,
  ): Promise<RatingLine[]> {
    const lines: RatingLine[] = [];

    for (const subscriptionItem of subscriptionItems) {
      const price = priceById[subscriptionItem.priceId];

      if (!price) {
        throw new NotFoundError(`No such price: ${subscriptionItem.priceId}`);
      }

      const window = resolveBillingWindow(
        subscriptionItem.billedFrom,
        subscriptionItem.billedThrough,
        subscriptionItem.invoicedThrough,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd,
      );

      if (window) {
        const line = await this.buildLine(subscription, subscriptionItem, price, window);

        lines.push(line);
      }
    }

    return lines;
  }

  private async buildLine(
    subscription: Subscription,
    item: SubscriptionItem,
    price: Price,
    window: BillingWindow,
  ): Promise<RatingLine> {
    const isMetered = price.usageType === UsageTypeEnum.METERED;
    const quantity = isMetered
      ? await this.resolveUsage(subscription, price, window.start, window.end)
      : item.quantity;

    return {
      subscriptionItemId: item.id,
      price: RatingService.buildRatingPrice(price),
      type: RatingService.resolveLineItemType(isMetered, window.isPartial),
      quantity,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
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
