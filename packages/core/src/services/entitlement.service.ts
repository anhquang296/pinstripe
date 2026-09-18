import { MAX_ITEMS_PER_SUBSCRIPTION } from '@constants/subscription';
import type { EntitlementResponse, FindEntitlementsQuery } from '@contracts/entitlements.types';
import type { EntitlementStatus } from '@contracts/entitlements.types';
import { EntitlementStatusEnum } from '@contracts/entitlements.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { SubscriptionStatus } from '@contracts/subscriptions.types';
import { SubscriptionStatusEnum } from '@contracts/subscriptions.types';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { RedisNamespaceEnum } from '@utils/redis-key-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const ENTITLEMENT_CACHE_TTL_SECONDS = 300;

const ENTITLEMENT_BY_SUBSCRIPTION_STATUS: Record<SubscriptionStatus, EntitlementStatus> = {
  [SubscriptionStatusEnum.INCOMPLETE]: EntitlementStatusEnum.BLOCKED,
  [SubscriptionStatusEnum.INCOMPLETE_EXPIRED]: EntitlementStatusEnum.REVOKED,
  [SubscriptionStatusEnum.TRIALING]: EntitlementStatusEnum.ACTIVE,
  [SubscriptionStatusEnum.ACTIVE]: EntitlementStatusEnum.ACTIVE,
  [SubscriptionStatusEnum.PAST_DUE]: EntitlementStatusEnum.ACTIVE,
  [SubscriptionStatusEnum.UNPAID]: EntitlementStatusEnum.BLOCKED,
  [SubscriptionStatusEnum.PAUSED]: EntitlementStatusEnum.ACTIVE,
  [SubscriptionStatusEnum.CANCELED]: EntitlementStatusEnum.REVOKED,
};

export class EntitlementService {
  constructor(private readonly fastify: FastifyInstance) {}

  async handleSubscriptionChanged(subscriptionId: string): Promise<void> {
    const subscription = await this.fastify.subscriptionRepository.getSubscription(subscriptionId);

    const status = ENTITLEMENT_BY_SUBSCRIPTION_STATUS[subscription.status];

    const now = this.fastify.clock.now().toISOString();

    if (status === EntitlementStatusEnum.REVOKED) {
      const revokedEntitlements = await this.fastify.entitlementRepository.findEntitlements(
        { subscriptionId },
        MAX_ITEMS_PER_SUBSCRIPTION,
      );

      await this.fastify.entitlementRepository.revokeEntitlements(subscriptionId, status, now);

      await this.invalidateCache(subscription.customerId, _.map(revokedEntitlements, 'productId'));

      return;
    }

    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: [subscriptionId],
      deletedAtIsNull: true,
    });

    const priceIds = _.map(subscriptionItems, 'priceId');

    const prices = await this.fastify.priceRepository.findPrices(
      { ids: priceIds },
      MAX_ITEMS_PER_SUBSCRIPTION,
    );

    for (const price of prices) {
      await this.fastify.entitlementRepository.upsertEntitlement({
        id: generateGid(ObjectPrefixEnum.ENTITLEMENT),
        customerId: subscription.customerId,
        subscriptionId,
        productId: price.productId,
        status,
        grantedAt: now,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    await this.invalidateCache(subscription.customerId, _.map(prices, 'productId'));
  }

  async getEntitlementStatus(customerId: string, productId: string): Promise<EntitlementStatus> {
    const cacheKey = this.fastify.redisKeyFactory.build(
      RedisNamespaceEnum.ENTITLEMENT,
      customerId,
      productId,
    );

    const cached = await this.fastify.redis.get(cacheKey);

    if (cached) {
      return cached as EntitlementStatus;
    }

    const [entitlement] = await this.fastify.entitlementRepository.findEntitlements(
      { customerId: customerId, productId: productId, status: EntitlementStatusEnum.ACTIVE },
      1,
    );

    const status = entitlement ? entitlement.status : EntitlementStatusEnum.REVOKED;

    await this.fastify.redis.set(cacheKey, status, 'EX', ENTITLEMENT_CACHE_TTL_SECONDS);

    return status;
  }

  async findEntitlements(query: FindEntitlementsQuery): Promise<ListResponse<EntitlementResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const entitlementRows = await this.fastify.entitlementRepository.findEntitlements(
      { customerId: query.customerId, productId: query.productId },
      limit + 1,
    );

    const hasMore = entitlementRows.length > limit;

    return {
      url: '/v1/entitlements',
      hasMore,
      data: _.take(entitlementRows, limit),
    };
  }

  private async invalidateCache(customerId: string, productIds: readonly string[]): Promise<void> {
    if (_.isEmpty(productIds)) {
      return;
    }

    const keys = _.map(productIds, (productId) => {
      return this.fastify.redisKeyFactory.build(
        RedisNamespaceEnum.ENTITLEMENT,
        customerId,
        productId,
      );
    });

    await this.fastify.redis.del(...keys);
  }
}
