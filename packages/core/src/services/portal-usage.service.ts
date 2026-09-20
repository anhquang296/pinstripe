import type { PortalUsageResponse } from '@contracts/portal.types';
import { UsageTypeEnum } from '@contracts/prices.types';
import { SubscriptionStatusEnum } from '@contracts/subscriptions.types';
import type { Price, Subscription, SubscriptionItem } from '@database/schemas';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const LIVE_SUBSCRIPTION_STATUSES: string[] = [
  SubscriptionStatusEnum.ACTIVE,
  SubscriptionStatusEnum.TRIALING,
  SubscriptionStatusEnum.PAST_DUE,
  SubscriptionStatusEnum.UNPAID,
];

type PortalUsageItem = PortalUsageResponse['items'][number];

function resolveIncludedQuantity(price: Price): number | null {
  const { tiers } = price;

  if (tiers) {
    const [firstTier] = tiers;

    return _.get(firstTier, 'upTo', null);
  }

  return null;
}

export class PortalUsageService {
  constructor(private readonly fastify: FastifyInstance) {}

  async findCustomerUsage(customerId: string): Promise<PortalUsageResponse> {
    const SUBSCRIPTION_LIMIT = 50;

    const subscriptions = await this.fastify.subscriptionRepository.findSubscriptions(
      { customerId },
      SUBSCRIPTION_LIMIT,
    );
    const liveSubscriptions = _.filter(subscriptions, (subscription) => {
      return _.includes(LIVE_SUBSCRIPTION_STATUSES, subscription.status);
    });
    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: _.map(liveSubscriptions, 'id'),
      deletedAtIsNull: true,
    });
    const priceIds = _(subscriptionItems).map('priceId').uniq().value();
    const prices = await this.fastify.priceRepository.findPrices(
      { ids: priceIds },
      priceIds.length,
    );
    const meteredPricesById = _(prices)
      .filter((price) => {
        return price.usageType === UsageTypeEnum.METERED && price.meterId !== null;
      })
      .keyBy('id')
      .value();
    const productIds = _(meteredPricesById).map('productId').uniq().value();
    const products = await this.fastify.productRepository.findProducts(
      { ids: productIds },
      productIds.length,
    );
    const productsById = _.keyBy(products, 'id');
    const subscriptionsById = _.keyBy(liveSubscriptions, 'id');

    const items: PortalUsageItem[] = [];

    for (const subscriptionItem of subscriptionItems) {
      const price = _.get(meteredPricesById, subscriptionItem.priceId);
      const subscription = _.get(subscriptionsById, subscriptionItem.subscriptionId);

      if (price && subscription) {
        items.push(await this.buildUsageItem(subscriptionItem, price, subscription, productsById));
      }
    }

    return { items };
  }

  private async buildUsageItem(
    subscriptionItem: SubscriptionItem,
    price: Price,
    subscription: Subscription,
    productsById: Record<string, { name: string }>,
  ): Promise<PortalUsageItem> {
    const meterId = String(price.meterId);
    const meter = await this.fastify.meterRepository.getMeter(meterId);
    const summary = await this.fastify.meterEventService.getMeterEventSummary(meterId, {
      customerId: subscription.customerId,
      windowStart: subscription.currentPeriodStart,
      windowEnd: subscription.currentPeriodEnd,
    });

    return {
      subscriptionItemId: subscriptionItem.id,
      subscriptionId: subscription.id,
      productName: _.get(productsById, [price.productId, 'name'], ''),
      meterName: meter.displayName,
      quantity: summary.value,
      includedQuantity: resolveIncludedQuantity(price),
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
    };
  }
}
