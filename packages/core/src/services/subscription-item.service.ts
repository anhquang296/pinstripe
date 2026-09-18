import { MAX_ITEMS_PER_SUBSCRIPTION } from '@constants/subscription';
import { DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreateSubscriptionItemPayload,
  DeletedSubscriptionItemResponse,
  DeleteSubscriptionItemPayload,
  FindSubscriptionItemsQuery,
  SubscriptionItemResponse,
  UpdateSubscriptionItemPayload,
  UpdateSubscriptionPayload,
} from '@contracts/subscriptions.types';
import type { ProrationBehavior } from '@contracts/subscriptions.types';
import { ProrationBehaviorEnum } from '@contracts/subscriptions.types';
import type { DatabaseTransaction } from '@database/database.client';
import type {
  NewSubscriptionItem,
  NewSubscriptionItemChange,
  Price,
  Subscription,
  SubscriptionItem,
} from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import { SubscriptionService } from '@services/subscription.service';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { assertPricesUsable } from '@utils/subscription-price';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export type SubscriptionItemLine = NonNullable<UpdateSubscriptionPayload['items']>[number];

export interface SubscriptionChangeTiming {
  now: Date;
  boundary: Date;
}

export class SubscriptionItemService {
  constructor(private readonly fastify: FastifyInstance) {}

  async findSubscriptionItems(
    query: FindSubscriptionItemsQuery,
    livemode: boolean,
  ): Promise<ListResponse<SubscriptionItemResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const subscription = await this.getSubscription(query.subscriptionId, livemode);

    const rows = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: [subscription.id],
      deletedAtIsNull: true,
    });

    return {
      url: '/v1/subscription_items',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  async getSubscriptionItem(id: string, livemode: boolean): Promise<SubscriptionItemResponse> {
    return this.getSubscriptionItemRow(id, livemode);
  }

  async createSubscriptionItem(
    payload: CreateSubscriptionItemPayload,
    livemode: boolean,
  ): Promise<SubscriptionItemResponse> {
    const subscription = await this.getSubscription(payload.subscriptionId, livemode);
    const timing = await this.resolveTiming(subscription, payload.prorationBehavior);
    const price = await this.getPrice(payload.priceId);

    assertPricesUsable([price], subscription.currency);

    const createdSubscriptionItem = await this.fastify.database.master.transaction(async (tx) => {
      const subscriptionItem = await this.openSubscriptionItem(
        subscription,
        {
          priceId: payload.priceId,
          quantity: payload.quantity,
          taxRates: payload.taxRates,
          metadata: payload.metadata,
        },
        timing,
        tx,
      );

      await this.settleChange(subscription, payload.prorationBehavior, timing, tx);

      return subscriptionItem;
    });

    return createdSubscriptionItem;
  }

  async updateSubscriptionItem(
    id: string,
    payload: UpdateSubscriptionItemPayload,
    livemode: boolean,
  ): Promise<SubscriptionItemResponse> {
    const subscriptionItem = await this.getSubscriptionItemRow(id, livemode);
    const subscription = await this.getSubscription(subscriptionItem.subscriptionId, livemode);
    const timing = await this.resolveTiming(subscription, payload.prorationBehavior);
    const line: SubscriptionItemLine = {
      id: subscriptionItem.id,
      priceId: payload.priceId ?? subscriptionItem.priceId,
      quantity: payload.quantity ?? subscriptionItem.quantity,
      taxRates: payload.taxRates ?? subscriptionItem.taxRates,
      metadata: payload.metadata ?? subscriptionItem.metadata,
    };
    const price = await this.getPrice(line.priceId);

    assertPricesUsable([price], subscription.currency);

    const changedSubscriptionItem = await this.fastify.database.master.transaction(async (tx) => {
      const next = await this.changeSubscriptionItem(
        subscription,
        subscriptionItem,
        line,
        timing,
        tx,
      );

      await this.settleChange(subscription, payload.prorationBehavior, timing, tx);

      return next;
    });

    return changedSubscriptionItem;
  }

  async deleteSubscriptionItem(
    id: string,
    payload: DeleteSubscriptionItemPayload,
    livemode: boolean,
  ): Promise<DeletedSubscriptionItemResponse> {
    const subscriptionItem = await this.getSubscriptionItemRow(id, livemode);
    const subscription = await this.getSubscription(subscriptionItem.subscriptionId, livemode);
    const liveItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: [subscription.id],
      deletedAtIsNull: true,
    });

    if (liveItems.length <= 1) {
      throw new ConflictError(
        `Subscription ${subscription.id} would be left without an item; cancel it instead`,
      );
    }

    const timing = await this.resolveTiming(subscription, payload.prorationBehavior);

    await this.fastify.database.master.transaction(async (tx) => {
      await this.closeSubscriptionItem(subscriptionItem, timing, tx);
      await this.settleChange(subscription, payload.prorationBehavior, timing, tx);
    });

    return { id, deleted: true };
  }

  async syncSubscriptionItems(
    subscription: Subscription,
    lines: readonly SubscriptionItemLine[],
    timing: SubscriptionChangeTiming,
    tx: DatabaseTransaction,
  ): Promise<void> {
    const liveItems = await this.fastify.subscriptionRepository.findSubscriptionItems(
      { subscriptionIds: [subscription.id], deletedAtIsNull: true },
      tx,
    );
    const prices = await this.resolvePrices(_.map(lines, 'priceId'));

    assertPricesUsable(prices, subscription.currency);

    const matchedItemIds: string[] = [];

    for (const line of lines) {
      const matchedItem = SubscriptionItemService.matchItem(liveItems, matchedItemIds, line);

      if (matchedItem) {
        matchedItemIds.push(matchedItem.id);

        await this.changeSubscriptionItem(subscription, matchedItem, line, timing, tx);

        continue;
      }

      await this.openSubscriptionItem(subscription, line, timing, tx);
    }

    const removedItems = _.reject(liveItems, (liveItem) => {
      return _.includes(matchedItemIds, liveItem.id);
    });

    for (const removedItem of removedItems) {
      await this.closeSubscriptionItem(removedItem, timing, tx);
    }
  }

  private async openSubscriptionItem(
    subscription: Subscription,
    line: SubscriptionItemLine,
    timing: SubscriptionChangeTiming,
    tx: DatabaseTransaction,
  ): Promise<SubscriptionItemResponse> {
    const subscriptionItem = {
      id: generateGid(ObjectPrefixEnum.SUBSCRIPTION_ITEM),
      livemode: subscription.livemode,
      subscriptionId: subscription.id,
      priceId: line.priceId,
      quantity: line.quantity ?? 1,
      taxRates: line.taxRates ?? [],
      metadata: line.metadata ?? {},
      createdAt: timing.now.toISOString(),
    } satisfies NewSubscriptionItem;

    await this.fastify.subscriptionRepository.createSubscriptionItems([subscriptionItem], tx);
    await this.fastify.subscriptionRepository.createSubscriptionItemChanges(
      [
        SubscriptionItemService.buildItemChange(
          subscription,
          subscriptionItem.id,
          line.priceId,
          subscriptionItem.quantity,
          timing,
        ),
      ],
      tx,
    );

    return subscriptionItem;
  }

  private async changeSubscriptionItem(
    subscription: Subscription,
    subscriptionItem: SubscriptionItem,
    line: SubscriptionItemLine,
    timing: SubscriptionChangeTiming,
    tx: DatabaseTransaction,
  ): Promise<SubscriptionItem> {
    const quantity = line.quantity ?? subscriptionItem.quantity;
    const isRebilled =
      line.priceId !== subscriptionItem.priceId || quantity !== subscriptionItem.quantity;

    if (isRebilled) {
      await this.fastify.subscriptionRepository.closeSubscriptionItemChanges(
        [subscriptionItem.id],
        timing.boundary.toISOString(),
        tx,
      );
      await this.fastify.subscriptionRepository.createSubscriptionItemChanges(
        [
          SubscriptionItemService.buildItemChange(
            subscription,
            subscriptionItem.id,
            line.priceId,
            quantity,
            timing,
          ),
        ],
        tx,
      );
    }

    const changedItem = await this.fastify.subscriptionRepository.updateSubscriptionItem(
      subscriptionItem.id,
      {
        priceId: line.priceId,
        quantity,
        taxRates: line.taxRates ?? subscriptionItem.taxRates,
        metadata: line.metadata ?? subscriptionItem.metadata,
      },
      tx,
    );

    if (changedItem) {
      return changedItem;
    }

    throw new NotFoundError(`No such subscription item: ${subscriptionItem.id}`);
  }

  private async closeSubscriptionItem(
    subscriptionItem: SubscriptionItem,
    timing: SubscriptionChangeTiming,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.subscriptionRepository.closeSubscriptionItemChanges(
      [subscriptionItem.id],
      timing.boundary.toISOString(),
      tx,
    );
    await this.fastify.subscriptionRepository.deleteSubscriptionItems(
      [subscriptionItem.id],
      timing.now.toISOString(),
      tx,
    );
  }

  private async settleChange(
    subscription: Subscription,
    prorationBehavior: ProrationBehavior | undefined,
    timing: SubscriptionChangeTiming,
    tx: DatabaseTransaction,
  ): Promise<void> {
    if (prorationBehavior === ProrationBehaviorEnum.ALWAYS_INVOICE) {
      await this.fastify.invoiceService.issueProrationInvoice(subscription, timing.now, tx);
    }

    const next = await this.fastify.subscriptionRepository.updateSubscription(
      subscription.id,
      { updatedAt: timing.now.toISOString() },
      tx,
    );

    if (next) {
      await this.fastify.outboxService.recordEvents(
        [
          SubscriptionService.buildSubscriptionEvent(
            next,
            DomainEventTypeEnum.SUBSCRIPTION_UPDATED,
          ),
        ],
        tx,
      );

      return;
    }

    throw new NotFoundError(`No such subscription: ${subscription.id}`);
  }

  private async resolveTiming(
    subscription: Subscription,
    prorationBehavior: ProrationBehavior | undefined,
  ): Promise<SubscriptionChangeTiming> {
    const now = await this.fastify.clockService.resolveSubscriptionNow(subscription);
    const isProrated =
      (prorationBehavior ?? ProrationBehaviorEnum.CREATE_PRORATIONS) !== ProrationBehaviorEnum.NONE;

    if (isProrated) {
      return { now, boundary: now };
    }

    return { now, boundary: new Date(subscription.currentPeriodStart) };
  }

  private async getSubscription(id: string, livemode: boolean): Promise<Subscription> {
    const subscription = await this.fastify.subscriptionRepository.findSubscription(id);

    if (subscription && subscription.livemode === livemode) {
      return subscription;
    }

    throw new NotFoundError(`No such subscription: ${id}`);
  }

  private async getSubscriptionItemRow(id: string, livemode: boolean): Promise<SubscriptionItem> {
    const subscriptionItem = await this.fastify.subscriptionRepository.findSubscriptionItem(id);

    if (subscriptionItem && subscriptionItem.livemode === livemode) {
      if (subscriptionItem.deletedAt) {
        throw new NotFoundError(`No such subscription item: ${id}`);
      }

      return subscriptionItem;
    }

    throw new NotFoundError(`No such subscription item: ${id}`);
  }

  private async getPrice(id: string): Promise<Price> {
    const [price] = await this.fastify.priceRepository.findPrices({ ids: [id] }, 1);

    if (price) {
      return price;
    }

    throw new NotFoundError(`No such price: ${id}`);
  }

  private async resolvePrices(priceIds: readonly string[]): Promise<Price[]> {
    const prices = await this.fastify.priceRepository.findPrices(
      { ids: _.uniq([...priceIds]) },
      MAX_ITEMS_PER_SUBSCRIPTION,
    );

    for (const priceId of priceIds) {
      if (!_.some(prices, { id: priceId })) {
        throw new NotFoundError(`No such price: ${priceId}`);
      }
    }

    return prices;
  }

  private static matchItem(
    liveItems: readonly SubscriptionItem[],
    matchedItemIds: readonly string[],
    line: SubscriptionItemLine,
  ): SubscriptionItem | null {
    const available = _.reject(liveItems, (liveItem) => {
      return _.includes(matchedItemIds, liveItem.id);
    });

    if (line.id) {
      const identified = _.find(available, { id: line.id });

      if (identified) {
        return identified;
      }

      throw new BadRequestError(`No such subscription item: ${line.id}`, { param: 'items' });
    }

    return _.find(available, { priceId: line.priceId }) ?? null;
  }

  private static buildItemChange(
    subscription: Subscription,
    subscriptionItemId: string,
    priceId: string,
    quantity: number,
    timing: SubscriptionChangeTiming,
  ): NewSubscriptionItemChange {
    return {
      id: generateGid(ObjectPrefixEnum.SUBSCRIPTION_ITEM_CHANGE),
      livemode: subscription.livemode,
      subscriptionId: subscription.id,
      subscriptionItemId,
      priceId,
      quantity,
      billedFrom: timing.boundary.toISOString(),
      billedThrough: null,
      invoicedThrough: null,
      createdAt: timing.now.toISOString(),
    };
  }
}
