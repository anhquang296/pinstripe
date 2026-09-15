import type { FastifyInstance } from 'fastify';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { RecurringInterval } from '@contracts/prices.types';
import { PriceTypeEnum } from '@contracts/prices.types';
import type {
  CancelSubscriptionPayload,
  CreateSubscriptionPayload,
  GetSubscriptionsQuery,
  Subscription,
  SubscriptionItem,
  SubscriptionStatus,
  UpdateSubscriptionPayload,
} from '@contracts/subscriptions.types';
import {
  CollectionMethodEnum,
  SUBSCRIPTION_TRANSITIONS,
  SubscriptionStatusEnum,
} from '@contracts/subscriptions.types';
import type { DatabaseTransaction } from '@database/database.client';
import type {
  NewSubscriptionItemEntity,
  PriceEntity,
  SubscriptionEntity,
  SubscriptionItemEntity,
} from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { advancePeriod } from '@utils/billing-period';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_ITEMS_PER_SUBSCRIPTION = 100;
const MAX_PERIOD_ROLLS = 120;
const ADVANCE_BATCH_SIZE = 500;

export interface SubscriptionInterval {
  interval: RecurringInterval;
  intervalCount: number;
}

export class SubscriptionService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createSubscription(payload: CreateSubscriptionPayload): Promise<Subscription> {
    const customer = await this.fastify.customerService.getCustomer(payload.customerId);
    const prices = await this.resolvePrices(payload.items.map((item) => item.priceId));
    const now = await this.resolveNow(customer.testClockId);

    SubscriptionService.assertPricesUsable(prices, customer.currency);

    const subscriptionId = generateId(ObjectPrefixEnum.SUBSCRIPTION);
    const trialEnd = SubscriptionService.resolveTrialEnd(payload, now);
    const anchor = payload.billingCycleAnchor
      ? new Date(payload.billingCycleAnchor)
      : (trialEnd ?? now);
    const { interval, intervalCount } = SubscriptionService.resolveInterval(prices);
    const items: NewSubscriptionItemEntity[] = payload.items.map((item) => ({
      id: generateId(ObjectPrefixEnum.SUBSCRIPTION_ITEM),
      subscriptionId,
      priceId: item.priceId,
      quantity: item.quantity ?? 1,
      metadata: item.metadata ?? {},
      createdAt: now,
    }));

    const created = await this.fastify.database.master.transaction(async (tx) => {
      const subscription = await this.fastify.subscriptionRepository.createSubscription(
        {
          id: subscriptionId,
          customerId: customer.id,
          status: trialEnd ? SubscriptionStatusEnum.TRIALING : SubscriptionStatusEnum.ACTIVE,
          currency: customer.currency,
          collectionMethod: payload.collectionMethod ?? CollectionMethodEnum.CHARGE_AUTOMATICALLY,
          billingCycleAnchor: anchor,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd ?? advancePeriod(anchor, interval, intervalCount),
          chargedThroughDate: null,
          trialStart: trialEnd ? now : null,
          trialEnd,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          endedAt: null,
          testClockId: customer.testClockId,
          metadata: payload.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        },
        items,
        tx,
      );

      if (!subscription) {
        throw new NotFoundError(`Subscription ${subscriptionId} could not be created`);
      }

      await this.recordSubscriptionEvent(
        subscription,
        DomainEventTypeEnum.SUBSCRIPTION_CREATED,
        tx,
      );

      return subscription;
    });

    return SubscriptionService.buildSubscription(created, items);
  }

  async getSubscription(id: string): Promise<Subscription> {
    const subscription = await this.fastify.subscriptionRepository.findSubscription(id);

    if (!subscription) {
      throw new NotFoundError(`No such subscription: ${id}`);
    }

    const items = await this.fastify.subscriptionRepository.findSubscriptionItems([id]);

    return SubscriptionService.buildSubscription(subscription, items);
  }

  async findSubscriptions(query: GetSubscriptionsQuery): Promise<ListResponse<Subscription>> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const rows = await this.fastify.subscriptionRepository.findSubscriptions(
      {
        customerIdEq: query.customerId,
        statusEq: query.status,
        beforeCursor: await this.resolveCursor(query.startingAfter),
        afterCursor: await this.resolveCursor(query.endingBefore),
      },
      limit + 1,
    );
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const items = await this.fastify.subscriptionRepository.findSubscriptionItems(
      page.map((subscription) => subscription.id),
    );

    return {
      object: 'list',
      url: '/v1/subscriptions',
      hasMore,
      data: page.map((subscription) => {
        return SubscriptionService.buildSubscription(
          subscription,
          items.filter((item) => item.subscriptionId === subscription.id),
        );
      }),
    };
  }

  async updateSubscription(id: string, payload: UpdateSubscriptionPayload): Promise<Subscription> {
    const subscription = await this.fastify.subscriptionRepository.findSubscription(id);

    if (!subscription) {
      throw new NotFoundError(`No such subscription: ${id}`);
    }

    if (subscription.status === SubscriptionStatusEnum.CANCELED) {
      throw new ConflictError(`Subscription ${id} is canceled and can no longer be updated`);
    }

    const now = await this.resolveNow(subscription.testClockId);
    const items = payload.items
      ? payload.items.map((item) => ({
          id: generateId(ObjectPrefixEnum.SUBSCRIPTION_ITEM),
          subscriptionId: id,
          priceId: item.priceId,
          quantity: item.quantity ?? 1,
          metadata: item.metadata ?? {},
          createdAt: now,
        }))
      : null;

    if (items) {
      const prices = await this.resolvePrices(items.map((item) => item.priceId));

      SubscriptionService.assertPricesUsable(prices, subscription.currency);
    }

    const updated = await this.fastify.database.master.transaction(async (tx) => {
      if (items) {
        await this.fastify.subscriptionRepository.replaceSubscriptionItems(id, items, now, tx);
      }

      const next = await this.fastify.subscriptionRepository.updateSubscription(
        id,
        {
          cancelAtPeriodEnd: payload.cancelAtPeriodEnd ?? subscription.cancelAtPeriodEnd,
          metadata: payload.metadata ?? subscription.metadata,
          updatedAt: now,
        },
        tx,
      );

      if (!next) {
        throw new NotFoundError(`No such subscription: ${id}`);
      }

      await this.recordSubscriptionEvent(next, DomainEventTypeEnum.SUBSCRIPTION_UPDATED, tx);

      return next;
    });

    return this.getSubscription(updated.id);
  }

  async cancelSubscription(id: string, payload: CancelSubscriptionPayload): Promise<Subscription> {
    const subscription = await this.fastify.subscriptionRepository.findSubscription(id);

    if (!subscription) {
      throw new NotFoundError(`No such subscription: ${id}`);
    }

    if (subscription.status === SubscriptionStatusEnum.CANCELED) {
      throw new ConflictError(`Subscription ${id} is already canceled`);
    }

    const now = await this.resolveNow(subscription.testClockId);

    if (payload.cancelAtPeriodEnd) {
      const marked = await this.fastify.database.master.transaction(async (tx) => {
        const next = await this.fastify.subscriptionRepository.updateSubscription(
          id,
          { cancelAtPeriodEnd: true, canceledAt: now, updatedAt: now },
          tx,
        );

        if (!next) {
          throw new NotFoundError(`No such subscription: ${id}`);
        }

        await this.recordSubscriptionEvent(next, DomainEventTypeEnum.SUBSCRIPTION_UPDATED, tx);

        return next;
      });

      return this.getSubscription(marked.id);
    }

    SubscriptionService.assertTransition(subscription.status, SubscriptionStatusEnum.CANCELED);

    const canceled = await this.fastify.database.master.transaction(async (tx) => {
      const next = await this.fastify.subscriptionRepository.updateSubscription(
        id,
        {
          status: SubscriptionStatusEnum.CANCELED,
          canceledAt: now,
          endedAt: now,
          cancelAtPeriodEnd: false,
          updatedAt: now,
        },
        tx,
      );

      if (!next) {
        throw new NotFoundError(`No such subscription: ${id}`);
      }

      await this.recordSubscriptionEvent(next, DomainEventTypeEnum.SUBSCRIPTION_CANCELED, tx);

      return next;
    });

    return this.getSubscription(canceled.id);
  }

  async advanceSubscriptions(testClockId: string, now: Date): Promise<number> {
    const due = await this.fastify.subscriptionRepository.findSubscriptions(
      {
        testClockIdEq: testClockId,
        statusNe: SubscriptionStatusEnum.CANCELED,
        currentPeriodEndLte: now,
      },
      ADVANCE_BATCH_SIZE,
    );

    for (const subscription of due) {
      await this.advanceSubscription(subscription, now);
    }

    return due.length;
  }

  private async advanceSubscription(subscription: SubscriptionEntity, now: Date): Promise<void> {
    const items = await this.fastify.subscriptionRepository.findSubscriptionItems([
      subscription.id,
    ]);
    const prices = await this.resolvePrices(items.map((item) => item.priceId));
    const { interval, intervalCount } = SubscriptionService.resolveInterval(prices);

    let current = subscription;
    let rolls = 0;

    while (current.currentPeriodEnd.getTime() <= now.getTime() && rolls < MAX_PERIOD_ROLLS) {
      current = await this.rollPeriod(current, interval, intervalCount);
      rolls += 1;

      if (current.status === SubscriptionStatusEnum.CANCELED) {
        return;
      }
    }
  }

  private async rollPeriod(
    subscription: SubscriptionEntity,
    interval: RecurringInterval,
    intervalCount: number,
  ): Promise<SubscriptionEntity> {
    const periodEnd = subscription.currentPeriodEnd;

    if (subscription.cancelAtPeriodEnd) {
      return this.writeTransition(
        subscription,
        {
          status: SubscriptionStatusEnum.CANCELED,
          endedAt: periodEnd,
          cancelAtPeriodEnd: false,
          canceledAt: subscription.canceledAt ?? periodEnd,
          updatedAt: periodEnd,
        },
        DomainEventTypeEnum.SUBSCRIPTION_CANCELED,
      );
    }

    const isTrialEnding = subscription.status === SubscriptionStatusEnum.TRIALING;

    return this.writeTransition(
      subscription,
      {
        status: SubscriptionStatusEnum.ACTIVE,
        currentPeriodStart: periodEnd,
        currentPeriodEnd: advancePeriod(periodEnd, interval, intervalCount),
        updatedAt: periodEnd,
      },
      isTrialEnding
        ? DomainEventTypeEnum.SUBSCRIPTION_TRIAL_ENDED
        : DomainEventTypeEnum.SUBSCRIPTION_RENEWED,
    );
  }

  private async writeTransition(
    subscription: SubscriptionEntity,
    changes: Partial<SubscriptionEntity>,
    eventType: DomainEventTypeEnum,
  ): Promise<SubscriptionEntity> {
    if (changes.status && changes.status !== subscription.status) {
      SubscriptionService.assertTransition(subscription.status, changes.status);
    }

    return this.fastify.database.master.transaction(async (tx) => {
      const next = await this.fastify.subscriptionRepository.updateSubscription(
        subscription.id,
        changes,
        tx,
      );

      if (!next) {
        throw new NotFoundError(`No such subscription: ${subscription.id}`);
      }

      await this.recordSubscriptionEvent(next, eventType, tx);

      return next;
    });
  }

  private async recordSubscriptionEvent(
    subscription: SubscriptionEntity,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.SUBSCRIPTION,
          aggregateId: subscription.id,
          eventType,
          payload: {
            id: subscription.id,
            customerId: subscription.customerId,
            status: subscription.status,
          },
        },
      ],
      tx,
    );
  }

  private async resolveNow(testClockId: string | null): Promise<Date> {
    if (!testClockId) {
      return this.fastify.clock.now();
    }

    const clock = await this.fastify.testClockRepository.findTestClock(testClockId);

    if (!clock) {
      throw new NotFoundError(`No such test clock: ${testClockId}`);
    }

    return clock.frozenTime;
  }

  private async resolvePrices(priceIds: readonly string[]): Promise<PriceEntity[]> {
    const prices = await this.fastify.priceRepository.findPrices(
      { idIn: priceIds },
      MAX_ITEMS_PER_SUBSCRIPTION,
    );

    for (const priceId of priceIds) {
      if (!prices.some((price) => price.id === priceId)) {
        throw new NotFoundError(`No such price: ${priceId}`);
      }
    }

    return prices;
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (!id) {
      return undefined;
    }

    const subscription = await this.fastify.subscriptionRepository.findSubscription(id);

    if (!subscription) {
      throw new NotFoundError(`No such subscription: ${id}`);
    }

    return { createdAt: subscription.createdAt, id: subscription.id };
  }

  private static resolveTrialEnd(payload: CreateSubscriptionPayload, now: Date): Date | null {
    if (payload.trialEnd) {
      return new Date(payload.trialEnd);
    }

    if (payload.trialPeriodDays) {
      return new Date(now.getTime() + payload.trialPeriodDays * MILLISECONDS_PER_DAY);
    }

    return null;
  }

  private static resolveInterval(prices: readonly PriceEntity[]): SubscriptionInterval {
    const [first] = prices;

    if (!first?.recurringInterval || !first.recurringIntervalCount) {
      throw new BadRequestError('A subscription needs at least one recurring price', {
        param: 'items',
      });
    }

    return { interval: first.recurringInterval, intervalCount: first.recurringIntervalCount };
  }

  private static assertPricesUsable(prices: readonly PriceEntity[], currency: string): void {
    for (const price of prices) {
      if (!price.active) {
        throw new BadRequestError(`Price ${price.id} is archived and cannot be subscribed to`, {
          param: 'items',
        });
      }

      if (price.type !== PriceTypeEnum.RECURRING) {
        throw new BadRequestError(`Price ${price.id} is one time and cannot be subscribed to`, {
          param: 'items',
        });
      }

      if (price.currency !== currency) {
        throw new BadRequestError(
          `Price ${price.id} is in ${price.currency} but the customer bills in ${currency}`,
          { param: 'items' },
        );
      }
    }

    const [first] = prices;
    const mismatched = prices.find((price) => {
      return (
        price.recurringInterval !== first?.recurringInterval ||
        price.recurringIntervalCount !== first?.recurringIntervalCount
      );
    });

    if (mismatched) {
      throw new BadRequestError(
        'Every price on a subscription must share the same billing period',
        {
          param: 'items',
        },
      );
    }
  }

  private static assertTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
    if (!SUBSCRIPTION_TRANSITIONS[from].includes(to)) {
      throw new ConflictError(`A subscription cannot move from ${from} to ${to}`);
    }
  }

  private static buildSubscription(
    entity: SubscriptionEntity,
    items: readonly (SubscriptionItemEntity | NewSubscriptionItemEntity)[],
  ): Subscription {
    return {
      object: 'subscription',
      id: entity.id,
      customerId: entity.customerId,
      status: entity.status,
      currency: entity.currency,
      collectionMethod: entity.collectionMethod,
      items: items.map((item): SubscriptionItem => {
        return {
          object: 'subscription_item',
          id: item.id,
          subscriptionId: item.subscriptionId,
          priceId: item.priceId,
          quantity: item.quantity ?? 1,
          metadata: item.metadata ?? {},
          createdAt: (item.createdAt ?? entity.createdAt).toISOString(),
        };
      }),
      billingCycleAnchor: entity.billingCycleAnchor.toISOString(),
      currentPeriodStart: entity.currentPeriodStart.toISOString(),
      currentPeriodEnd: entity.currentPeriodEnd.toISOString(),
      chargedThroughDate: entity.chargedThroughDate
        ? entity.chargedThroughDate.toISOString()
        : null,
      trialStart: entity.trialStart ? entity.trialStart.toISOString() : null,
      trialEnd: entity.trialEnd ? entity.trialEnd.toISOString() : null,
      cancelAtPeriodEnd: entity.cancelAtPeriodEnd,
      canceledAt: entity.canceledAt ? entity.canceledAt.toISOString() : null,
      endedAt: entity.endedAt ? entity.endedAt.toISOString() : null,
      testClockId: entity.testClockId,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
