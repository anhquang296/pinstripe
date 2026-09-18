import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { SubscriptionStatus } from '@contracts/subscriptions.types';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type {
  NewSubscription,
  NewSubscriptionItem,
  NewSubscriptionItemChange,
  Subscription,
  SubscriptionItem,
  SubscriptionItemChange,
} from '@database/schemas';
import { subscriptionItemChanges, subscriptionItems, subscriptions } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import _ from 'lodash';

export interface SubscriptionItemFilters {
  ids?: readonly string[];
  subscriptionIds?: readonly string[];
  deletedAtIsNull?: boolean;
}

export interface SubscriptionItemChangeFilters {
  ids?: readonly string[];
  subscriptionIds?: readonly string[];
  subscriptionItemIds?: readonly string[];
  billedThroughIsNull?: boolean;
  billedFromBeforeAt?: Date;
  billedThroughAfterAt?: Date;
}

export interface SubscriptionFilters {
  livemode?: boolean;
  ids?: readonly string[];
  customerId?: string;
  status?: SubscriptionStatus;
  statusNe?: SubscriptionStatus;
  testClockId?: string;
  currentPeriodEndTo?: Date;
  cancelAtTo?: Date;
  pauseResumesAtTo?: Date;
  updatedAtTo?: Date;
  statuses?: readonly SubscriptionStatus[];
  shardCount?: number;
  shardIndex?: number;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class SubscriptionRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findSubscription(id: string): Promise<Subscription | null> {
    const [subscription] = await this._db.master
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);

    return subscription ?? null;
  }

  async findSubscriptions(
    filters: SubscriptionFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<Subscription[]> {
    const where = and(
      filters.livemode === undefined ? undefined : eq(subscriptions.livemode, filters.livemode),
      filters.ids ? inArray(subscriptions.id, [...filters.ids]) : undefined,
      filters.customerId ? eq(subscriptions.customerId, filters.customerId) : undefined,
      filters.status ? eq(subscriptions.status, filters.status) : undefined,
      filters.statusNe ? ne(subscriptions.status, filters.statusNe) : undefined,
      filters.testClockId ? eq(subscriptions.testClockId, filters.testClockId) : undefined,
      filters.currentPeriodEndTo
        ? lte(subscriptions.currentPeriodEnd, filters.currentPeriodEndTo)
        : undefined,
      filters.cancelAtTo ? lte(subscriptions.cancelAt, filters.cancelAtTo) : undefined,
      filters.pauseResumesAtTo
        ? lte(subscriptions.pauseCollectionResumesAt, filters.pauseResumesAtTo)
        : undefined,
      filters.updatedAtTo ? lte(subscriptions.updatedAt, filters.updatedAtTo) : undefined,
      filters.statuses ? inArray(subscriptions.status, [...filters.statuses]) : undefined,
      filters.shardCount && filters.shardIndex !== undefined
        ? sql`abs(hashtext(${subscriptions.id})) % ${filters.shardCount} = ${filters.shardIndex}`
        : undefined,
      filters.beforeAt
        ? sql`(${subscriptions.createdAt}, ${subscriptions.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${subscriptions.createdAt}, ${subscriptions.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(subscriptions)
      .where(where)
      .orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
      .limit(limit);
  }

  async findSubscriptionItem(id: string): Promise<SubscriptionItem | null> {
    const [subscriptionItem] = await this._db.master
      .select()
      .from(subscriptionItems)
      .where(eq(subscriptionItems.id, id))
      .limit(1);

    return subscriptionItem ?? null;
  }

  async findSubscriptionItems(
    filters: SubscriptionItemFilters = {},
    executor?: DatabaseTransaction,
  ): Promise<SubscriptionItem[]> {
    const subscriptionIds = filters.subscriptionIds;

    if (subscriptionIds && _.isEmpty(subscriptionIds)) {
      return [];
    }

    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    const where = and(
      filters.ids ? inArray(subscriptionItems.id, [...filters.ids]) : undefined,
      subscriptionIds ? inArray(subscriptionItems.subscriptionId, [...subscriptionIds]) : undefined,
      filters.deletedAtIsNull === undefined
        ? undefined
        : filters.deletedAtIsNull
          ? isNull(subscriptionItems.deletedAt)
          : isNotNull(subscriptionItems.deletedAt),
    );

    return db
      .select()
      .from(subscriptionItems)
      .where(where)
      .orderBy(asc(subscriptionItems.createdAt));
  }

  async findSubscriptionItemChanges(
    filters: SubscriptionItemChangeFilters = {},
    executor?: DatabaseTransaction,
  ): Promise<SubscriptionItemChange[]> {
    const subscriptionIds = filters.subscriptionIds;

    if (subscriptionIds && _.isEmpty(subscriptionIds)) {
      return [];
    }

    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    const where = and(
      filters.ids ? inArray(subscriptionItemChanges.id, [...filters.ids]) : undefined,
      subscriptionIds
        ? inArray(subscriptionItemChanges.subscriptionId, [...subscriptionIds])
        : undefined,
      filters.subscriptionItemIds
        ? inArray(subscriptionItemChanges.subscriptionItemId, [...filters.subscriptionItemIds])
        : undefined,
      filters.billedThroughIsNull === undefined
        ? undefined
        : filters.billedThroughIsNull
          ? isNull(subscriptionItemChanges.billedThrough)
          : isNotNull(subscriptionItemChanges.billedThrough),
      filters.billedFromBeforeAt
        ? lt(subscriptionItemChanges.billedFrom, filters.billedFromBeforeAt)
        : undefined,
      filters.billedThroughAfterAt
        ? or(
            isNull(subscriptionItemChanges.billedThrough),
            gt(subscriptionItemChanges.billedThrough, filters.billedThroughAfterAt),
          )
        : undefined,
    );

    return db
      .select()
      .from(subscriptionItemChanges)
      .where(where)
      .orderBy(asc(subscriptionItemChanges.billedFrom), asc(subscriptionItemChanges.id));
  }

  async createSubscription(
    payload: NewSubscription,
    items: readonly NewSubscriptionItem[],
    changes: readonly NewSubscriptionItemChange[],
    executor?: DatabaseTransaction,
  ): Promise<Subscription | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [subscription] = await db.insert(subscriptions).values(payload).returning();

    await db.insert(subscriptionItems).values([...items]);
    await db.insert(subscriptionItemChanges).values([...changes]);

    return subscription ?? null;
  }

  async updateSubscription(
    id: string,
    payload: Partial<NewSubscription>,
    executor?: DatabaseTransaction,
  ): Promise<Subscription | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [subscription] = await db
      .update(subscriptions)
      .set(payload)
      .where(eq(subscriptions.id, id))
      .returning();

    return subscription ?? null;
  }

  async createSubscriptionItems(
    items: readonly NewSubscriptionItem[],
    executor?: DatabaseTransaction,
  ): Promise<void> {
    if (_.isEmpty(items)) {
      return;
    }

    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db.insert(subscriptionItems).values([...items]);
  }

  async updateSubscriptionItem(
    id: string,
    payload: Partial<NewSubscriptionItem>,
    executor?: DatabaseTransaction,
  ): Promise<SubscriptionItem | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [subscriptionItem] = await db
      .update(subscriptionItems)
      .set(payload)
      .where(eq(subscriptionItems.id, id))
      .returning();

    return subscriptionItem ?? null;
  }

  async deleteSubscriptionItems(
    ids: readonly string[],
    deletedAt: Date,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    if (_.isEmpty(ids)) {
      return;
    }

    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(subscriptionItems)
      .set({ deletedAt })
      .where(inArray(subscriptionItems.id, [...ids]));
  }

  async createSubscriptionItemChanges(
    changes: readonly NewSubscriptionItemChange[],
    executor?: DatabaseTransaction,
  ): Promise<void> {
    if (_.isEmpty(changes)) {
      return;
    }

    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db.insert(subscriptionItemChanges).values([...changes]);
  }

  async closeSubscriptionItemChanges(
    subscriptionItemIds: readonly string[],
    billedThrough: Date,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    if (_.isEmpty(subscriptionItemIds)) {
      return;
    }

    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(subscriptionItemChanges)
      .set({ billedThrough })
      .where(
        and(
          inArray(subscriptionItemChanges.subscriptionItemId, [...subscriptionItemIds]),
          isNull(subscriptionItemChanges.billedThrough),
        ),
      );
  }

  async markSubscriptionItemChangesInvoiced(
    ids: readonly string[],
    executor?: DatabaseTransaction,
  ): Promise<void> {
    if (_.isEmpty(ids)) {
      return;
    }

    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(subscriptionItemChanges)
      .set({ invoicedThrough: sql`${subscriptionItemChanges.billedThrough}` })
      .where(inArray(subscriptionItemChanges.id, [...ids]));
  }

  async invoiceSubscriptionItemChanges(
    ids: readonly string[],
    through: Date,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    if (_.isEmpty(ids)) {
      return;
    }

    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const boundary = sql`${through.toISOString()}::timestamptz`;

    await db
      .update(subscriptionItemChanges)
      .set({
        invoicedThrough: sql`least(coalesce(${subscriptionItemChanges.billedThrough}, 'infinity'::timestamptz), greatest(coalesce(${subscriptionItemChanges.invoicedThrough}, ${boundary}), ${boundary}))`,
      })
      .where(inArray(subscriptionItemChanges.id, [...ids]));
  }

  async reopenSubscriptionItemChangeInvoicing(
    ids: readonly string[],
    executor?: DatabaseTransaction,
  ): Promise<void> {
    if (_.isEmpty(ids)) {
      return;
    }

    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(subscriptionItemChanges)
      .set({ invoicedThrough: null })
      .where(inArray(subscriptionItemChanges.id, [...ids]));
  }
}
