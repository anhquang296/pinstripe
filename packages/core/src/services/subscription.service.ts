import { MAX_ITEMS_PER_SUBSCRIPTION } from '@constants/subscription';
import { MILLISECONDS_PER_DAY } from '@constants/time';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { RecurringInterval } from '@contracts/prices.types';
import { PriceTypeEnum } from '@contracts/prices.types';
import type {
  CancelSubscriptionPayload,
  CreateSubscriptionPayload,
  GetSubscriptionsQuery,
  SubscriptionItemResponse,
  SubscriptionResponse,
  SubscriptionStatus,
  UpdateSubscriptionPayload,
} from '@contracts/subscriptions.types';
import {
  CollectionMethodEnum,
  ProrationBehaviorEnum,
  SUBSCRIPTION_TRANSITIONS,
  SubscriptionStatusEnum,
} from '@contracts/subscriptions.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { NewSubscriptionItem, Price, Subscription, SubscriptionItem } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { advancePeriod } from '@utils/billing-period';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const MAX_PERIOD_ROLLS = 120;
const ADVANCE_BATCH_SIZE = 500;

export interface SubscriptionInterval {
  interval: RecurringInterval;
  intervalCount: number;
}

export class SubscriptionService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createSubscription(payload: CreateSubscriptionPayload): Promise<SubscriptionResponse> {
    const customer = await this.fastify.customerService.getCustomer(payload.customerId);
    const prices = await this.resolvePrices(_.map(payload.items, 'priceId'));
    const now = await this.resolveNow(customer.testClockId);

    SubscriptionService.assertPricesUsable(prices, customer.currency);

    const subscriptionId = generateGid(ObjectPrefixEnum.SUBSCRIPTION);
    const trialEnd = SubscriptionService.resolveTrialEnd(payload, now);
    const anchor = payload.billingCycleAnchor
      ? new Date(payload.billingCycleAnchor)
      : (trialEnd ?? now);
    const { interval, intervalCount } = SubscriptionService.resolveInterval(prices);
    const subscriptionItems: NewSubscriptionItem[] = _.map(payload.items, (subscriptionItem) => {
      return {
        id: generateGid(ObjectPrefixEnum.SUBSCRIPTION_ITEM),
        subscriptionId,
        priceId: subscriptionItem.priceId,
        quantity: subscriptionItem.quantity ?? 1,
        metadata: subscriptionItem.metadata ?? {},
        createdAt: now,
        billedFrom: now,
        billedThrough: null,
        invoicedThrough: null,
      };
    });

    const createdSubscription = await this.fastify.database.master.transaction(async (tx) => {
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
        subscriptionItems,
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

    return SubscriptionService.buildSubscription(createdSubscription, subscriptionItems);
  }

  async getSubscription(id: string): Promise<SubscriptionResponse> {
    const subscription = await this.fastify.subscriptionRepository.findSubscription(id);

    if (!subscription) {
      throw new NotFoundError(`No such subscription: ${id}`);
    }

    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: [id],
      deletedAtIsNull: true,
    });

    return SubscriptionService.buildSubscription(subscription, subscriptionItems);
  }

  async findSubscriptions(
    query: GetSubscriptionsQuery,
  ): Promise<ListResponse<SubscriptionResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const rows = await this.fastify.subscriptionRepository.findSubscriptions(
      {
        customerId: query.customerId,
        status: query.status,
        beforeAt: await this.resolveCursor(query.startingAfter),
        afterAt: await this.resolveCursor(query.endingBefore),
      },
      limit + 1,
    );
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: _.map(page, 'id'),
      deletedAtIsNull: true,
    });

    return {
      object: 'list',
      url: '/v1/subscriptions',
      hasMore,
      data: _.map(page, (subscription) => {
        return SubscriptionService.buildSubscription(
          subscription,
          _.filter(subscriptionItems, { subscriptionId: subscription.id }),
        );
      }),
    };
  }

  async updateSubscription(
    id: string,
    payload: UpdateSubscriptionPayload,
  ): Promise<SubscriptionResponse> {
    const subscription = await this.fastify.subscriptionRepository.findSubscription(id);

    if (!subscription) {
      throw new NotFoundError(`No such subscription: ${id}`);
    }

    if (subscription.status === SubscriptionStatusEnum.CANCELED) {
      throw new ConflictError(`Subscription ${id} is canceled and can no longer be updated`);
    }

    if (payload.prorationBehavior && !payload.items) {
      throw new BadRequestError('prorationBehavior only applies when items change', {
        param: 'prorationBehavior',
      });
    }

    const now = await this.resolveNow(subscription.testClockId);
    const prorationBehavior = payload.prorationBehavior ?? ProrationBehaviorEnum.CREATE_PRORATIONS;
    const isProrated = prorationBehavior !== ProrationBehaviorEnum.NONE;
    const boundary = isProrated ? now : subscription.currentPeriodStart;
    const subscriptionItems = payload.items
      ? _.map(payload.items, (subscriptionItem) => {
          return {
            id: generateGid(ObjectPrefixEnum.SUBSCRIPTION_ITEM),
            subscriptionId: id,
            priceId: subscriptionItem.priceId,
            quantity: subscriptionItem.quantity ?? 1,
            metadata: subscriptionItem.metadata ?? {},
            createdAt: now,
            billedFrom: boundary,
            billedThrough: null,
            invoicedThrough: null,
          };
        })
      : null;

    if (subscriptionItems) {
      const prices = await this.resolvePrices(_.map(subscriptionItems, 'priceId'));

      SubscriptionService.assertPricesUsable(prices, subscription.currency);
    }

    const updatedSubscription = await this.fastify.database.master.transaction(async (tx) => {
      if (subscriptionItems) {
        await this.fastify.subscriptionRepository.replaceSubscriptionItems(
          id,
          subscriptionItems,
          now,
          boundary,
          tx,
        );
      }

      if (subscriptionItems && prorationBehavior === ProrationBehaviorEnum.ALWAYS_INVOICE) {
        await this.fastify.invoiceService.issueProrationInvoice(subscription, now, tx);
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

    return this.getSubscription(updatedSubscription.id);
  }

  async cancelSubscription(
    id: string,
    payload: CancelSubscriptionPayload,
  ): Promise<SubscriptionResponse> {
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
        testClockId: testClockId,
        statusNe: SubscriptionStatusEnum.CANCELED,
        currentPeriodEndTo: now,
      },
      ADVANCE_BATCH_SIZE,
    );

    for (const subscription of due) {
      await this.advanceSubscription(subscription, now);
    }

    return due.length;
  }

  private async advanceSubscription(subscription: Subscription, now: Date): Promise<void> {
    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: [subscription.id],
      deletedAtIsNull: true,
    });
    const prices = await this.resolvePrices(_.map(subscriptionItems, 'priceId'));
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
    subscription: Subscription,
    interval: RecurringInterval,
    intervalCount: number,
  ): Promise<Subscription> {
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
    subscription: Subscription,
    changes: Partial<Subscription>,
    eventType: DomainEventTypeEnum,
  ): Promise<Subscription> {
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
    subscription: Subscription,
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

  private async resolvePrices(priceIds: readonly string[]): Promise<Price[]> {
    const prices = await this.fastify.priceRepository.findPrices(
      { ids: priceIds },
      MAX_ITEMS_PER_SUBSCRIPTION,
    );

    for (const priceId of priceIds) {
      if (!_.some(prices, { id: priceId })) {
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

  private static resolveInterval(prices: readonly Price[]): SubscriptionInterval {
    const [firstPrice] = prices;
    const interval = _.get(firstPrice, 'recurringInterval');
    const intervalCount = _.get(firstPrice, 'recurringIntervalCount');

    if (interval && intervalCount) {
      return { interval, intervalCount };
    }

    throw new BadRequestError('A subscription needs at least one recurring price', {
      param: 'items',
    });
  }

  private static assertPricesUsable(prices: readonly Price[], currency: string): void {
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

    const [firstPrice] = prices;

    if (!firstPrice) {
      throw new BadRequestError('A subscription needs at least one price', { param: 'items' });
    }

    const mismatchedPrice = _.find(prices, (price) => {
      return (
        price.recurringInterval !== firstPrice.recurringInterval ||
        price.recurringIntervalCount !== firstPrice.recurringIntervalCount
      );
    });

    if (mismatchedPrice) {
      throw new BadRequestError(
        'Every price on a subscription must share the same billing period',
        {
          param: 'items',
        },
      );
    }
  }

  private static assertTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
    if (!_.includes(SUBSCRIPTION_TRANSITIONS[from], to)) {
      throw new ConflictError(`A subscription cannot move from ${from} to ${to}`);
    }
  }

  private static buildSubscription(
    entity: Subscription,
    subscriptionItems: readonly (SubscriptionItem | NewSubscriptionItem)[],
  ): SubscriptionResponse {
    return {
      object: 'subscription',
      id: entity.id,
      customerId: entity.customerId,
      status: entity.status,
      currency: entity.currency,
      collectionMethod: entity.collectionMethod,
      items: _.map(subscriptionItems, (subscriptionItem): SubscriptionItemResponse => {
        return {
          object: 'subscription_item',
          id: subscriptionItem.id,
          subscriptionId: subscriptionItem.subscriptionId,
          priceId: subscriptionItem.priceId,
          quantity: subscriptionItem.quantity ?? 1,
          metadata: subscriptionItem.metadata ?? {},
          createdAt: (subscriptionItem.createdAt ?? entity.createdAt).toISOString(),
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
