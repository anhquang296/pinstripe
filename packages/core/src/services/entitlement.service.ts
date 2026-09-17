import { MAX_ITEMS_PER_SUBSCRIPTION } from '@constants/subscription';
import type { EntitlementResponse, GetEntitlementsQuery } from '@contracts/entitlements.types';
import type { EntitlementStatus } from '@contracts/entitlements.types';
import { EntitlementStatusEnum } from '@contracts/entitlements.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { SubscriptionStatus } from '@contracts/subscriptions.types';
import { SubscriptionStatusEnum } from '@contracts/subscriptions.types';
import type { Entitlement, Subscription } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { RedisNamespaceEnum } from '@utils/redis-key-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const ENTITLEMENT_CACHE_TTL_SECONDS = 300;

const ENTITLEMENT_BY_SUBSCRIPTION_STATUS: Record<SubscriptionStatus, EntitlementStatus> = {
  [SubscriptionStatusEnum.INCOMPLETE]: EntitlementStatusEnum.BLOCKED,
  [SubscriptionStatusEnum.TRIALING]: EntitlementStatusEnum.ACTIVE,
  [SubscriptionStatusEnum.ACTIVE]: EntitlementStatusEnum.ACTIVE,
  [SubscriptionStatusEnum.PAST_DUE]: EntitlementStatusEnum.ACTIVE,
  [SubscriptionStatusEnum.UNPAID]: EntitlementStatusEnum.BLOCKED,
  [SubscriptionStatusEnum.CANCELED]: EntitlementStatusEnum.REVOKED,
};

export class EntitlementService {
  constructor(private readonly fastify: FastifyInstance) {}

  async handleSubscriptionChanged(subscriptionId: string): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    const status = ENTITLEMENT_BY_SUBSCRIPTION_STATUS[subscription.status];
    const now = this.fastify.clock.now();

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
        livemode: subscription.livemode,
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

  async findEntitlements(query: GetEntitlementsQuery): Promise<ListResponse<EntitlementResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const entitlementRows = await this.fastify.entitlementRepository.findEntitlements(
      { customerId: query.customerId, productId: query.productId },
      limit + 1,
    );
    const hasMore = entitlementRows.length > limit;

    return {
      object: 'list',
      url: '/v1/entitlements',
      hasMore,
      data: _(entitlementRows).take(limit).map(EntitlementService.buildEntitlement).value(),
    };
  }

  private async getSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.fastify.subscriptionRepository.findSubscription(subscriptionId);

    if (subscription) {
      return subscription;
    }

    throw new NotFoundError(`No such subscription: ${subscriptionId}`);
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

  private static buildEntitlement(entity: Entitlement): EntitlementResponse {
    return {
      object: 'entitlement',
      id: entity.id,
      customerId: entity.customerId,
      subscriptionId: entity.subscriptionId,
      productId: entity.productId,
      status: entity.status,
      grantedAt: entity.grantedAt.toISOString(),
      revokedAt: entity.revokedAt ? entity.revokedAt.toISOString() : null,
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
