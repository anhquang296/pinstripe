import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { SubscriptionStatus } from '@contracts/subscriptions.types';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type {
  NewSubscription,
  NewSubscriptionItem,
  Subscription,
  SubscriptionItem,
} from '@database/schemas';
import { subscriptionItems, subscriptions } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, asc, desc, eq, inArray, isNull, lte, ne, sql } from 'drizzle-orm';

export interface SubscriptionFilters {
  customerId?: string;
  status?: SubscriptionStatus;
  statusNe?: SubscriptionStatus;
  testClockId?: string;
  currentPeriodEndTo?: Date;
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
      filters.customerId ? eq(subscriptions.customerId, filters.customerId) : undefined,
      filters.status ? eq(subscriptions.status, filters.status) : undefined,
      filters.statusNe ? ne(subscriptions.status, filters.statusNe) : undefined,
      filters.testClockId ? eq(subscriptions.testClockId, filters.testClockId) : undefined,
      filters.currentPeriodEndTo
        ? lte(subscriptions.currentPeriodEnd, filters.currentPeriodEndTo)
        : undefined,
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

  async findSubscriptionItems(subscriptionIds: readonly string[]): Promise<SubscriptionItem[]> {
    if (subscriptionIds.length === 0) {
      return [];
    }

    return this._db.master
      .select()
      .from(subscriptionItems)
      .where(
        and(
          inArray(subscriptionItems.subscriptionId, [...subscriptionIds]),
          isNull(subscriptionItems.deletedAt),
        ),
      )
      .orderBy(asc(subscriptionItems.createdAt));
  }

  async createSubscription(
    payload: NewSubscription,
    items: readonly NewSubscriptionItem[],
    executor?: DatabaseTransaction,
  ): Promise<Subscription | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [subscription] = await db.insert(subscriptions).values(payload).returning();

    await db.insert(subscriptionItems).values([...items]);

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

  async replaceSubscriptionItems(
    subscriptionId: string,
    items: readonly NewSubscriptionItem[],
    deletedAt: Date,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(subscriptionItems)
      .set({ deletedAt })
      .where(
        and(
          eq(subscriptionItems.subscriptionId, subscriptionId),
          isNull(subscriptionItems.deletedAt),
        ),
      );

    await db.insert(subscriptionItems).values([...items]);
  }
}
