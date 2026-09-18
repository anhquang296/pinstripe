import { INCOMPLETE_EXPIRY_HOURS, MAX_ITEMS_PER_SUBSCRIPTION } from '@constants/subscription';
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR } from '@constants/time';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { RecurringInterval } from '@contracts/prices.types';
import type {
  CancelSubscriptionPayload,
  CreateSubscriptionPayload,
  FindSubscriptionsQuery,
  SubscriptionItemResponse,
  SubscriptionResponse,
  SubscriptionStatus,
  TrialEndBehavior,
  UpdateSubscriptionPayload,
} from '@contracts/subscriptions.types';
import {
  BILLABLE_SUBSCRIPTION_STATUSES,
  BillingModeEnum,
  CancellationReasonEnum,
  CollectionMethodEnum,
  PauseCollectionBehaviorEnum,
  ProrationBehaviorEnum,
  SUBSCRIPTION_TRANSITIONS,
  SubscriptionStatusEnum,
  TrialEndBehaviorEnum,
} from '@contracts/subscriptions.types';
import type { DatabaseTransaction } from '@database/database.client';
import type {
  NewSubscription,
  NewSubscriptionItem,
  NewSubscriptionItemChange,
  Price,
  Subscription,
} from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import type { RecordEventPayload } from '@services/outbox.service';
import { advancePeriod } from '@utils/billing-period';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import { assertPricesUsable, resolveInterval } from '@utils/subscription-price';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const MAX_PERIOD_ROLLS = 120;
const ADVANCE_BATCH_SIZE = 500;
const ROLLABLE_STATUSES = [
  SubscriptionStatusEnum.INCOMPLETE,
  SubscriptionStatusEnum.TRIALING,
  SubscriptionStatusEnum.ACTIVE,
  SubscriptionStatusEnum.PAST_DUE,
  SubscriptionStatusEnum.PAUSED,
] as const;

export interface SubscriptionScanFilters {
  testClockId?: string;
  testClockIdIsNull?: boolean;
  shardCount?: number;
  shardIndex?: number;
}

export interface SubscriptionLifecycleResult {
  advanced: number;
  canceled: number;
  resumed: number;
  expired: number;
}

export class SubscriptionService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createSubscription(payload: CreateSubscriptionPayload): Promise<SubscriptionResponse> {
    const customer = await this.fastify.customerService.getCustomer(payload.customerId);
    const prices = await this.resolvePrices(_.map(payload.items, 'priceId'));
    const now = await this.fastify.clockService.resolveNow(customer.testClockId);

    assertPricesUsable(prices, customer.currency);

    const subscriptionId = generateGid(ObjectPrefixEnum.SUBSCRIPTION);
    const trialEnd = SubscriptionService.resolveTrialEnd(payload, now);
    const anchor = payload.billingCycleAnchor
      ? new Date(payload.billingCycleAnchor)
      : (trialEnd ?? now);
    const { interval, intervalCount } = resolveInterval(prices);
    const createdAt = now.toISOString();
    const currentPeriodEnd = trialEnd ?? advancePeriod(anchor, interval, intervalCount);
    const subscriptionItems = _.map(payload.items, (subscriptionItem) => {
      return {
        id: generateGid(ObjectPrefixEnum.SUBSCRIPTION_ITEM),
        subscriptionId,
        priceId: subscriptionItem.priceId,
        quantity: subscriptionItem.quantity ?? 1,
        taxRates: subscriptionItem.taxRates ?? [],
        metadata: subscriptionItem.metadata ?? {},
        createdAt,
      } satisfies NewSubscriptionItem;
    });
    const itemChanges: NewSubscriptionItemChange[] = _.map(
      subscriptionItems,
      (subscriptionItem): NewSubscriptionItemChange => {
        return {
          id: generateGid(ObjectPrefixEnum.SUBSCRIPTION_ITEM_CHANGE),
          subscriptionId,
          subscriptionItemId: subscriptionItem.id,
          priceId: subscriptionItem.priceId,
          quantity: subscriptionItem.quantity,
          billedFrom: createdAt,
          billedThrough: null,
          invoicedThrough: null,
          createdAt,
        };
      },
    );
    const missingPaymentMethod = _.get(
      payload,
      ['trialSettings', 'endBehavior', 'missingPaymentMethod'],
      TrialEndBehaviorEnum.CREATE_INVOICE,
    );

    const createdSubscription = await this.fastify.database.master.transaction(async (tx) => {
      const subscription = await this.fastify.subscriptionRepository.createSubscription(
        {
          id: subscriptionId,
          customerId: customer.id,
          status: trialEnd ? SubscriptionStatusEnum.TRIALING : SubscriptionStatusEnum.ACTIVE,
          currency: customer.currency,
          collectionMethod: payload.collectionMethod ?? CollectionMethodEnum.CHARGE_AUTOMATICALLY,
          billingMode: payload.billingMode ?? BillingModeEnum.ADVANCE,
          billingCycleAnchor: anchor.toISOString(),
          currentPeriodStart: createdAt,
          currentPeriodEnd: currentPeriodEnd.toISOString(),
          chargedThroughDate: null,
          defaultTaxRates: payload.defaultTaxRates ?? [],
          defaultPaymentMethodId: payload.defaultPaymentMethodId ?? null,
          trialStart: trialEnd ? createdAt : null,
          trialEnd: trialEnd ? trialEnd.toISOString() : null,
          trialEndBehaviorMissingPaymentMethod: missingPaymentMethod,
          pauseCollectionBehavior: null,
          pauseCollectionResumesAt: null,
          cancelAtPeriodEnd: false,
          cancelAt: payload.cancelAt ?? null,
          cancellationReason: null,
          cancellationComment: null,
          cancellationFeedback: null,
          canceledAt: null,
          endedAt: null,
          testClockId: customer.testClockId,
          metadata: payload.metadata ?? {},
          createdAt,
          updatedAt: createdAt,
        },
        subscriptionItems,
        itemChanges,
        tx,
      );

      if (subscription) {
        await this.recordSubscriptionEvent(
          subscription,
          DomainEventTypeEnum.SUBSCRIPTION_CREATED,
          tx,
        );

        return subscription;
      }

      throw new NotFoundError(`Subscription ${subscriptionId} could not be created`);
    });

    if (createdSubscription.billingMode === BillingModeEnum.ADVANCE && !trialEnd) {
      await this.fastify.invoiceService.issueSubscriptionCreateInvoice(createdSubscription, now);
    }

    return SubscriptionService.buildSubscription(createdSubscription, subscriptionItems);
  }

  async getSubscription(id: string): Promise<SubscriptionResponse> {
    const subscription = await this.getSubscriptionRow(id);
    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: [id],
      deletedAtIsNull: true,
    });

    return SubscriptionService.buildSubscription(subscription, subscriptionItems);
  }

  async findSubscriptions(
    query: FindSubscriptionsQuery,
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
    const subscription = await this.getSubscriptionRow(id);

    SubscriptionService.assertUpdatable(subscription);

    if (payload.prorationBehavior && !payload.items) {
      throw new BadRequestError('prorationBehavior only applies when items change', {
        param: 'prorationBehavior',
      });
    }

    const now = await this.fastify.clockService.resolveSubscriptionNow(subscription);
    const prorationBehavior = payload.prorationBehavior ?? ProrationBehaviorEnum.CREATE_PRORATIONS;
    const isProrated = prorationBehavior !== ProrationBehaviorEnum.NONE;
    const boundary = isProrated ? now : new Date(subscription.currentPeriodStart);
    const changes = this.resolveUpdateChanges(subscription, payload, now);

    const updatedSubscription = await this.fastify.database.master.transaction(async (tx) => {
      if (payload.items) {
        await this.fastify.subscriptionItemService.syncSubscriptionItems(
          subscription,
          payload.items,
          { now, boundary },
          tx,
        );
      }

      if (payload.items && prorationBehavior === ProrationBehaviorEnum.ALWAYS_INVOICE) {
        await this.fastify.invoiceService.issueProrationInvoice(subscription, now, tx);
      }

      const next = await this.fastify.subscriptionRepository.updateSubscription(id, changes, tx);

      if (next) {
        await this.recordSubscriptionEvent(
          next,
          SubscriptionService.resolveUpdateEventType(subscription, next),
          tx,
        );

        return next;
      }

      throw new NotFoundError(`No such subscription: ${id}`);
    });

    return this.getSubscription(updatedSubscription.id);
  }

  async cancelSubscription(
    id: string,
    payload: CancelSubscriptionPayload,
  ): Promise<SubscriptionResponse> {
    const subscription = await this.getSubscriptionRow(id);

    SubscriptionService.assertUpdatable(subscription);

    const now = await this.fastify.clockService.resolveSubscriptionNow(subscription);
    const details: Partial<NewSubscription> = {
      cancellationReason: CancellationReasonEnum.CANCELLATION_REQUESTED,
      cancellationComment: _.get(
        payload,
        ['cancellationDetails', 'comment'],
        payload.comment ?? null,
      ),
      cancellationFeedback: _.get(payload, ['cancellationDetails', 'feedback'], null),
    };

    if (payload.cancelAt) {
      const scheduled = await this.writeSubscription(
        id,
        { ...details, cancelAt: payload.cancelAt, updatedAt: now.toISOString() },
        DomainEventTypeEnum.SUBSCRIPTION_UPDATED,
      );

      return this.getSubscription(scheduled.id);
    }

    const canceledAt = now.toISOString();

    if (payload.cancelAtPeriodEnd) {
      const marked = await this.writeSubscription(
        id,
        { ...details, cancelAtPeriodEnd: true, canceledAt, updatedAt: canceledAt },
        DomainEventTypeEnum.SUBSCRIPTION_UPDATED,
      );

      return this.getSubscription(marked.id);
    }

    SubscriptionService.assertTransition(subscription.status, SubscriptionStatusEnum.CANCELED);

    const canceled = await this.writeSubscription(
      id,
      {
        ...details,
        status: SubscriptionStatusEnum.CANCELED,
        canceledAt,
        endedAt: canceledAt,
        cancelAtPeriodEnd: false,
        cancelAt: null,
        updatedAt: canceledAt,
      },
      DomainEventTypeEnum.SUBSCRIPTION_CANCELED,
    );

    return this.getSubscription(canceled.id);
  }

  async runSubscriptionLifecycle(
    filters: SubscriptionScanFilters,
    now: Date,
  ): Promise<SubscriptionLifecycleResult> {
    const advanced = await this.advanceSubscriptions(filters, now);
    const canceled = await this.cancelDueSubscriptions(filters, now);
    const resumed = await this.resumePausedSubscriptions(filters, now);
    const expired = await this.expireIncompleteSubscriptions(filters, now);

    return { advanced, canceled, resumed, expired };
  }

  async advanceSubscriptions(filters: SubscriptionScanFilters, now: Date): Promise<number> {
    const due = await this.fastify.subscriptionRepository.findSubscriptions(
      {
        testClockId: filters.testClockId,
        testClockIdIsNull: filters.testClockIdIsNull,
        shardCount: filters.shardCount,
        shardIndex: filters.shardIndex,
        statuses: ROLLABLE_STATUSES,
        currentPeriodEndTo: now.toISOString(),
      },
      ADVANCE_BATCH_SIZE,
    );

    for (const subscription of due) {
      await this.advanceSubscription(subscription, now);
    }

    return due.length;
  }

  async cancelDueSubscriptions(filters: SubscriptionScanFilters, now: Date): Promise<number> {
    const due = await this.fastify.subscriptionRepository.findSubscriptions(
      {
        testClockId: filters.testClockId,
        testClockIdIsNull: filters.testClockIdIsNull,
        shardCount: filters.shardCount,
        shardIndex: filters.shardIndex,
        statuses: ROLLABLE_STATUSES,
        cancelAtTo: now.toISOString(),
      },
      ADVANCE_BATCH_SIZE,
    );

    for (const subscription of due) {
      const subscriptionNow = await this.resolveScanNow(subscription, now);
      const { cancelAt } = subscription;

      if (cancelAt && new Date(cancelAt).getTime() <= subscriptionNow.getTime()) {
        await this.writeSubscription(
          subscription.id,
          {
            status: SubscriptionStatusEnum.CANCELED,
            canceledAt: subscription.canceledAt ?? cancelAt,
            endedAt: cancelAt,
            cancelAtPeriodEnd: false,
            cancellationReason:
              subscription.cancellationReason ?? CancellationReasonEnum.CANCELLATION_REQUESTED,
            updatedAt: subscriptionNow.toISOString(),
          },
          DomainEventTypeEnum.SUBSCRIPTION_CANCELED,
        );
      }
    }

    return due.length;
  }

  async resumePausedSubscriptions(filters: SubscriptionScanFilters, now: Date): Promise<number> {
    const due = await this.fastify.subscriptionRepository.findSubscriptions(
      {
        testClockId: filters.testClockId,
        testClockIdIsNull: filters.testClockIdIsNull,
        shardCount: filters.shardCount,
        shardIndex: filters.shardIndex,
        status: SubscriptionStatusEnum.PAUSED,
        pauseResumesAtTo: now.toISOString(),
      },
      ADVANCE_BATCH_SIZE,
    );

    for (const subscription of due) {
      const subscriptionNow = await this.resolveScanNow(subscription, now);
      const resumesAt = subscription.pauseCollectionResumesAt;

      if (resumesAt && new Date(resumesAt).getTime() <= subscriptionNow.getTime()) {
        await this.writeSubscription(
          subscription.id,
          {
            status: SubscriptionStatusEnum.ACTIVE,
            pauseCollectionBehavior: null,
            pauseCollectionResumesAt: null,
            updatedAt: subscriptionNow.toISOString(),
          },
          DomainEventTypeEnum.SUBSCRIPTION_RESUMED,
        );
      }
    }

    return due.length;
  }

  async expireIncompleteSubscriptions(
    filters: SubscriptionScanFilters,
    now: Date,
  ): Promise<number> {
    const expireBeforeAt = new Date(
      now.getTime() - INCOMPLETE_EXPIRY_HOURS * MILLISECONDS_PER_HOUR,
    );
    const stale = await this.fastify.subscriptionRepository.findSubscriptions(
      {
        testClockId: filters.testClockId,
        testClockIdIsNull: filters.testClockIdIsNull,
        shardCount: filters.shardCount,
        shardIndex: filters.shardIndex,
        status: SubscriptionStatusEnum.INCOMPLETE,
        updatedAtTo: expireBeforeAt.toISOString(),
      },
      ADVANCE_BATCH_SIZE,
    );

    for (const subscription of stale) {
      const subscriptionNow = await this.resolveScanNow(subscription, now);
      const updatedAt = new Date(subscription.updatedAt);
      const ageMs = subscriptionNow.getTime() - updatedAt.getTime();

      if (ageMs >= INCOMPLETE_EXPIRY_HOURS * MILLISECONDS_PER_HOUR) {
        const endedAt = subscriptionNow.toISOString();

        await this.writeSubscription(
          subscription.id,
          {
            status: SubscriptionStatusEnum.INCOMPLETE_EXPIRED,
            endedAt,
            cancellationReason: CancellationReasonEnum.PAYMENT_FAILED,
            updatedAt: endedAt,
          },
          DomainEventTypeEnum.SUBSCRIPTION_INCOMPLETE_EXPIRED,
        );
      }
    }

    return stale.length;
  }

  async handleInvoicePaymentFailed(
    subscriptionId: string,
    failedAt: Date,
    isFinalAttempt: boolean,
  ): Promise<void> {
    const subscription = await this.getSubscriptionRow(subscriptionId);
    const status = SubscriptionService.resolveFailedStatus(subscription, isFinalAttempt);

    if (status === subscription.status) {
      return;
    }

    if (!_.includes(SUBSCRIPTION_TRANSITIONS[subscription.status], status)) {
      return;
    }

    await this.writeSubscription(
      subscriptionId,
      { status, updatedAt: failedAt.toISOString() },
      DomainEventTypeEnum.SUBSCRIPTION_UPDATED,
    );

    this.fastify.log.info(
      { subscriptionId, status },
      '[SubscriptionService] handleInvoicePaymentFailed() moved the subscription',
    );
  }

  async handleInvoicePaymentSucceeded(
    subscriptionId: string,
    paidAt: Date,
    chargedThroughDate: Date,
  ): Promise<void> {
    const subscription = await this.getSubscriptionRow(subscriptionId);
    const isRecovering = _.includes(
      [
        SubscriptionStatusEnum.INCOMPLETE,
        SubscriptionStatusEnum.PAST_DUE,
        SubscriptionStatusEnum.UNPAID,
      ],
      subscription.status,
    );

    await this.writeSubscription(
      subscriptionId,
      {
        status: isRecovering ? SubscriptionStatusEnum.ACTIVE : subscription.status,
        chargedThroughDate: chargedThroughDate.toISOString(),
        updatedAt: paidAt.toISOString(),
      },
      DomainEventTypeEnum.SUBSCRIPTION_UPDATED,
    );
  }

  private resolveUpdateChanges(
    subscription: Subscription,
    payload: UpdateSubscriptionPayload,
    now: Date,
  ): Partial<NewSubscription> {
    const changes: Partial<NewSubscription> = {
      cancelAtPeriodEnd: payload.cancelAtPeriodEnd ?? subscription.cancelAtPeriodEnd,
      collectionMethod: payload.collectionMethod ?? subscription.collectionMethod,
      defaultTaxRates: payload.defaultTaxRates ?? subscription.defaultTaxRates,
      metadata: payload.metadata ?? subscription.metadata,
      updatedAt: now.toISOString(),
    };

    if (payload.cancelAt !== undefined) {
      changes.cancelAt = payload.cancelAt;
    }

    if (payload.defaultPaymentMethodId !== undefined) {
      changes.defaultPaymentMethodId = payload.defaultPaymentMethodId;
    }

    if (payload.trialSettings) {
      changes.trialEndBehaviorMissingPaymentMethod =
        payload.trialSettings.endBehavior.missingPaymentMethod;
    }

    if (payload.pauseCollection === undefined) {
      return changes;
    }

    if (payload.pauseCollection) {
      SubscriptionService.assertTransition(subscription.status, SubscriptionStatusEnum.PAUSED);

      const { behavior, resumesAt } = payload.pauseCollection;

      changes.status = SubscriptionStatusEnum.PAUSED;
      changes.pauseCollectionBehavior = behavior;
      changes.pauseCollectionResumesAt = resumesAt ?? null;

      return changes;
    }

    if (subscription.status === SubscriptionStatusEnum.PAUSED) {
      changes.status = SubscriptionStatusEnum.ACTIVE;
    }

    changes.pauseCollectionBehavior = null;
    changes.pauseCollectionResumesAt = null;

    return changes;
  }

  private async resolveScanNow(subscription: Subscription, runAt: Date): Promise<Date> {
    if (subscription.testClockId) {
      return this.fastify.clockService.resolveNow(subscription.testClockId);
    }

    return runAt;
  }

  private async advanceSubscription(subscription: Subscription, runAt: Date): Promise<void> {
    const now = await this.resolveScanNow(subscription, runAt);
    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: [subscription.id],
      deletedAtIsNull: true,
    });
    const prices = await this.resolvePrices(_.map(subscriptionItems, 'priceId'));
    const { interval, intervalCount } = resolveInterval(prices);

    let current = subscription;
    let rolls = 0;

    while (
      new Date(current.currentPeriodEnd).getTime() <= now.getTime() &&
      rolls < MAX_PERIOD_ROLLS
    ) {
      current = await this.rollPeriod(current, interval, intervalCount);
      rolls += 1;

      if (SubscriptionService.isTerminal(current.status)) {
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
    const { cancelAt } = subscription;
    const isAdvance = subscription.billingMode === BillingModeEnum.ADVANCE;
    const isBillable = _.includes(BILLABLE_SUBSCRIPTION_STATUSES, subscription.status);
    const isCancelDue =
      cancelAt !== null && new Date(cancelAt).getTime() <= new Date(periodEnd).getTime();

    if (!isAdvance && isBillable) {
      await this.fastify.invoiceService.ensureBillableDraft(subscription);
    }

    if (subscription.cancelAtPeriodEnd || isCancelDue) {
      const endedAt = isCancelDue ? cancelAt : periodEnd;

      if (isAdvance && isBillable) {
        await this.fastify.invoiceService.issueTrailingInvoice(subscription, new Date(endedAt), {
          interval,
          intervalCount,
        });
      }

      return this.writeSubscription(
        subscription.id,
        {
          status: SubscriptionStatusEnum.CANCELED,
          endedAt,
          cancelAtPeriodEnd: false,
          canceledAt: subscription.canceledAt ?? endedAt,
          cancellationReason:
            subscription.cancellationReason ?? CancellationReasonEnum.CANCELLATION_REQUESTED,
          updatedAt: endedAt,
        },
        DomainEventTypeEnum.SUBSCRIPTION_CANCELED,
      );
    }

    const rolled =
      subscription.status === SubscriptionStatusEnum.TRIALING
        ? await this.endTrial(subscription, interval, intervalCount)
        : await this.writeSubscription(
            subscription.id,
            {
              status: SubscriptionStatusEnum.ACTIVE,
              currentPeriodStart: periodEnd,
              currentPeriodEnd: advancePeriod(
                new Date(periodEnd),
                interval,
                intervalCount,
              ).toISOString(),
              updatedAt: periodEnd,
            },
            DomainEventTypeEnum.SUBSCRIPTION_RENEWED,
          );

    if (isAdvance && _.includes(BILLABLE_SUBSCRIPTION_STATUSES, rolled.status)) {
      await this.fastify.invoiceService.ensureBillableDraft(rolled);
    }

    return rolled;
  }

  private async endTrial(
    subscription: Subscription,
    interval: RecurringInterval,
    intervalCount: number,
  ): Promise<Subscription> {
    const periodEnd = subscription.currentPeriodEnd;
    const nextPeriodEnd = advancePeriod(new Date(periodEnd), interval, intervalCount).toISOString();
    const behavior = await this.resolveTrialEndBehavior(subscription);

    if (behavior === TrialEndBehaviorEnum.CANCEL) {
      return this.writeSubscription(
        subscription.id,
        {
          status: SubscriptionStatusEnum.CANCELED,
          endedAt: periodEnd,
          canceledAt: periodEnd,
          cancellationReason: CancellationReasonEnum.PAYMENT_FAILED,
          updatedAt: periodEnd,
        },
        DomainEventTypeEnum.SUBSCRIPTION_CANCELED,
      );
    }

    if (behavior === TrialEndBehaviorEnum.PAUSE) {
      return this.writeSubscription(
        subscription.id,
        {
          status: SubscriptionStatusEnum.PAUSED,
          pauseCollectionBehavior: PauseCollectionBehaviorEnum.KEEP_AS_DRAFT,
          pauseCollectionResumesAt: null,
          currentPeriodStart: periodEnd,
          currentPeriodEnd: nextPeriodEnd,
          updatedAt: periodEnd,
        },
        DomainEventTypeEnum.SUBSCRIPTION_PAUSED,
      );
    }

    return this.writeSubscription(
      subscription.id,
      {
        status: SubscriptionStatusEnum.ACTIVE,
        currentPeriodStart: periodEnd,
        currentPeriodEnd: nextPeriodEnd,
        updatedAt: periodEnd,
      },
      DomainEventTypeEnum.SUBSCRIPTION_TRIAL_ENDED,
    );
  }

  private async resolveTrialEndBehavior(subscription: Subscription): Promise<TrialEndBehavior> {
    if (subscription.collectionMethod !== CollectionMethodEnum.CHARGE_AUTOMATICALLY) {
      return TrialEndBehaviorEnum.CREATE_INVOICE;
    }

    const paymentMethod = await this.resolvePaymentMethod(subscription);

    if (paymentMethod) {
      return TrialEndBehaviorEnum.CREATE_INVOICE;
    }

    return subscription.trialEndBehaviorMissingPaymentMethod;
  }

  private async resolvePaymentMethod(subscription: Subscription): Promise<string | null> {
    if (subscription.defaultPaymentMethodId) {
      return subscription.defaultPaymentMethodId;
    }

    const customer = await this.fastify.customerRepository.findCustomer(subscription.customerId);

    return _.get(customer, 'defaultPaymentMethodId', null);
  }

  private async writeSubscription(
    id: string,
    changes: Partial<NewSubscription>,
    eventType: DomainEventTypeEnum,
  ): Promise<Subscription> {
    return this.fastify.database.master.transaction(async (tx) => {
      const next = await this.fastify.subscriptionRepository.updateSubscription(id, changes, tx);

      if (next) {
        await this.recordSubscriptionEvent(next, eventType, tx);

        return next;
      }

      throw new NotFoundError(`No such subscription: ${id}`);
    });
  }

  private async recordSubscriptionEvent(
    subscription: Subscription,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [SubscriptionService.buildSubscriptionEvent(subscription, eventType)],
      tx,
    );
  }

  private async getSubscriptionRow(id: string): Promise<Subscription> {
    const subscription = await this.fastify.subscriptionRepository.findSubscription(id);

    if (subscription) {
      return subscription;
    }

    throw new NotFoundError(`No such subscription: ${id}`);
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
    if (id) {
      const subscription = await this.getSubscriptionRow(id);

      return { createdAt: subscription.createdAt, id: subscription.id };
    }

    return undefined;
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

  private static resolveFailedStatus(
    subscription: Subscription,
    isFinalAttempt: boolean,
  ): SubscriptionStatus {
    if (isFinalAttempt) {
      return SubscriptionStatusEnum.UNPAID;
    }

    if (subscription.chargedThroughDate) {
      return SubscriptionStatusEnum.PAST_DUE;
    }

    return SubscriptionStatusEnum.INCOMPLETE;
  }

  private static resolveUpdateEventType(
    subscription: Subscription,
    next: Subscription,
  ): DomainEventTypeEnum {
    if (next.status === subscription.status) {
      return DomainEventTypeEnum.SUBSCRIPTION_UPDATED;
    }

    if (next.status === SubscriptionStatusEnum.PAUSED) {
      return DomainEventTypeEnum.SUBSCRIPTION_PAUSED;
    }

    if (subscription.status === SubscriptionStatusEnum.PAUSED) {
      return DomainEventTypeEnum.SUBSCRIPTION_RESUMED;
    }

    return DomainEventTypeEnum.SUBSCRIPTION_UPDATED;
  }

  private static isTerminal(status: SubscriptionStatus): boolean {
    return _.includes(
      [SubscriptionStatusEnum.CANCELED, SubscriptionStatusEnum.INCOMPLETE_EXPIRED],
      status,
    );
  }

  private static assertUpdatable(subscription: Subscription): void {
    if (SubscriptionService.isTerminal(subscription.status)) {
      throw new ConflictError(
        `Subscription ${subscription.id} is ${subscription.status} and can no longer be updated`,
      );
    }
  }

  private static assertTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
    if (!_.includes(SUBSCRIPTION_TRANSITIONS[from], to)) {
      throw new ConflictError(`A subscription cannot move from ${from} to ${to}`);
    }
  }

  static buildSubscriptionEvent(
    subscription: Subscription,
    eventType: DomainEventTypeEnum,
  ): RecordEventPayload {
    return {
      aggregateType: AggregateTypeEnum.SUBSCRIPTION,
      aggregateId: subscription.id,
      eventType,
      payload: {
        id: subscription.id,
        customerId: subscription.customerId,
        status: subscription.status,
      },
    };
  }

  static buildSubscription(
    entity: Subscription,
    subscriptionItems: SubscriptionItemResponse[],
  ): SubscriptionResponse {
    return {
      id: entity.id,
      customerId: entity.customerId,
      status: entity.status,
      currency: entity.currency,
      collectionMethod: entity.collectionMethod,
      billingMode: entity.billingMode,
      items: subscriptionItems,
      billingCycleAnchor: entity.billingCycleAnchor,
      currentPeriodStart: entity.currentPeriodStart,
      currentPeriodEnd: entity.currentPeriodEnd,
      chargedThroughDate: entity.chargedThroughDate,
      defaultTaxRates: entity.defaultTaxRates,
      defaultPaymentMethodId: entity.defaultPaymentMethodId,
      trialStart: entity.trialStart,
      trialEnd: entity.trialEnd,
      trialSettings: {
        endBehavior: { missingPaymentMethod: entity.trialEndBehaviorMissingPaymentMethod },
      },
      pauseCollection: entity.pauseCollectionBehavior
        ? {
            behavior: entity.pauseCollectionBehavior,
            resumesAt: entity.pauseCollectionResumesAt,
          }
        : null,
      cancelAtPeriodEnd: entity.cancelAtPeriodEnd,
      cancelAt: entity.cancelAt,
      cancellationDetails: {
        reason: entity.cancellationReason,
        comment: entity.cancellationComment,
        feedback: entity.cancellationFeedback,
      },
      canceledAt: entity.canceledAt,
      endedAt: entity.endedAt,
      testClockId: entity.testClockId,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
