import type { FastifyInstance } from 'fastify';
import type { Entitlement, GetEntitlementsQuery } from '@contracts/entitlements.types';
import { EntitlementStatusEnum } from '@contracts/entitlements.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { EntitlementStatus } from '@contracts/entitlements.types';
import type { SubscriptionStatus } from '@contracts/subscriptions.types';
import { SubscriptionStatusEnum } from '@contracts/subscriptions.types';
import type { EntitlementEntity } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';
import { RedisNamespaceEnum } from '@utils/redis-key-factory';

const ENTITLEMENT_CACHE_TTL_SECONDS = 300;
const MAX_ITEMS_PER_SUBSCRIPTION = 100;

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
    const subscription = await this.fastify.subscriptionRepository.findSubscription(subscriptionId);

    if (!subscription) {
      throw new NotFoundError(`No such subscription: ${subscriptionId}`);
    }

    const status = ENTITLEMENT_BY_SUBSCRIPTION_STATUS[subscription.status];
    const now = this.fastify.clock.now();

    if (status === EntitlementStatusEnum.REVOKED) {
      const revoked = await this.fastify.entitlementRepository.findEntitlements(
        { subscriptionIdEq: subscriptionId },
        MAX_ITEMS_PER_SUBSCRIPTION,
      );

      await this.fastify.entitlementRepository.revokeEntitlements(subscriptionId, status, now);
      await this.invalidateCache(
        subscription.customerId,
        revoked.map((entitlement) => entitlement.productId),
      );

      return;
    }

    const items = await this.fastify.subscriptionRepository.findSubscriptionItems([subscriptionId]);
    const priceIds = items.map((item) => item.priceId);
    const prices = await this.fastify.priceRepository.findPrices(
      { idIn: priceIds },
      MAX_ITEMS_PER_SUBSCRIPTION,
    );

    for (const price of prices) {
      await this.fastify.entitlementRepository.upsertEntitlement({
        id: generateId(ObjectPrefixEnum.ENTITLEMENT),
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

    await this.invalidateCache(
      subscription.customerId,
      prices.map((price) => price.productId),
    );
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
      { customerIdEq: customerId, productIdEq: productId, statusEq: EntitlementStatusEnum.ACTIVE },
      1,
    );
    const status = entitlement ? entitlement.status : EntitlementStatusEnum.REVOKED;

    await this.fastify.redis.set(cacheKey, status, 'EX', ENTITLEMENT_CACHE_TTL_SECONDS);

    return status;
  }

  async findEntitlements(query: GetEntitlementsQuery): Promise<ListResponse<Entitlement>> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const rows = await this.fastify.entitlementRepository.findEntitlements(
      { customerIdEq: query.customerId, productIdEq: query.productId },
      limit + 1,
    );
    const hasMore = rows.length > limit;

    return {
      object: 'list',
      url: '/v1/entitlements',
      hasMore,
      data: rows.slice(0, limit).map(EntitlementService.buildEntitlement),
    };
  }

  private async invalidateCache(customerId: string, productIds: readonly string[]): Promise<void> {
    if (productIds.length === 0) {
      return;
    }

    const keys = productIds.map((productId) => {
      return this.fastify.redisKeyFactory.build(
        RedisNamespaceEnum.ENTITLEMENT,
        customerId,
        productId,
      );
    });

    await this.fastify.redis.del(...keys);
  }

  private static buildEntitlement(entity: EntitlementEntity): Entitlement {
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
