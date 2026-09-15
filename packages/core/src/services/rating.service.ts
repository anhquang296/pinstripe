import { UsageTypeEnum } from '@contracts/prices.types';
import type { RatedInvoiceResponse } from '@contracts/rating.types';
import type { Price, Subscription, SubscriptionItem } from '@database/schemas';
import { BadRequestError, NotFoundError } from '@errors/app.error';
import type { LineItemType, RatedLineItem, RatingLine, RatingPrice } from '@utils/rating';
import { LineItemTypeEnum, rateLines } from '@utils/rating';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class RatingService {
  constructor(private readonly fastify: FastifyInstance) {}

  async rateUpcomingInvoice(subscriptionId: string): Promise<RatedInvoiceResponse> {
    const subscription = await this.fastify.subscriptionRepository.findSubscription(subscriptionId);

    if (!subscription) {
      throw new NotFoundError(`No such subscription: ${subscriptionId}`);
    }

    const items = await this.fastify.subscriptionRepository.findSubscriptionItems([subscriptionId]);
    const priceById = await this.resolvePrices(_.map(items, 'priceId'));
    const lines = await this.buildLines(subscription, items, priceById);
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
    items: readonly SubscriptionItem[],
    priceById: Record<string, Price>,
  ): Promise<RatingLine[]> {
    const lines: RatingLine[] = [];

    for (const subscriptionItem of items) {
      const price = priceById[subscriptionItem.priceId];

      if (!price) {
        throw new NotFoundError(`No such price: ${subscriptionItem.priceId}`);
      }

      const line = await this.buildLine(subscription, subscriptionItem, price);

      lines.push(line);
    }

    return lines;
  }

  private async buildLine(
    subscription: Subscription,
    item: SubscriptionItem,
    price: Price,
  ): Promise<RatingLine> {
    const isMetered = price.usageType === UsageTypeEnum.METERED;
    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;
    const startedMidPeriod = item.createdAt.getTime() > periodStart.getTime();
    const quantity = isMetered
      ? await this.resolveUsage(subscription, price, periodStart, periodEnd)
      : item.quantity;

    return {
      subscriptionItemId: item.id,
      price: RatingService.buildRatingPrice(price),
      type: RatingService.resolveLineItemType(isMetered, startedMidPeriod),
      quantity,
      periodStart,
      periodEnd,
      usageStart: startedMidPeriod && !isMetered ? item.createdAt : null,
      usageEnd: startedMidPeriod && !isMetered ? periodEnd : null,
      isCredit: false,
    };
  }

  private async resolveUsage(
    subscription: Subscription,
    price: Price,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<number> {
    const meterId = price.meterId;

    if (meterId) {
      const summary = await this.fastify.meterEventService.getMeterEventSummary(meterId, {
        customerId: subscription.customerId,
        windowStart: periodStart.toISOString(),
        windowEnd: periodEnd.toISOString(),
      });

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

  private static resolveLineItemType(isMetered: boolean, startedMidPeriod: boolean): LineItemType {
    if (isMetered) {
      return LineItemTypeEnum.USAGE;
    }

    if (startedMidPeriod) {
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
