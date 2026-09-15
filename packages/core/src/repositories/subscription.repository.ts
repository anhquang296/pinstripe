import { and, asc, desc, eq, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import type { SubscriptionStatus } from '@contracts/subscriptions.types';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type {
  NewSubscriptionEntity,
  NewSubscriptionItemEntity,
  SubscriptionEntity,
  SubscriptionItemEntity,
} from '@database/schemas';
import { subscriptionItems, subscriptions } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';

export interface FindSubscriptionsFilters {
  customerIdEq?: string;
  statusEq?: SubscriptionStatus;
  statusNe?: SubscriptionStatus;
  testClockIdEq?: string;
  currentPeriodEndLte?: Date;
  beforeCursor?: RowCursor;
  afterCursor?: RowCursor;
}

export class SubscriptionRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findSubscription(id: string): Promise<SubscriptionEntity | null> {
    const [subscription] = await this._db.master
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);

    return subscription ?? null;
  }

  async findSubscriptions(
    filters: FindSubscriptionsFilters,
    limit: number,
  ): Promise<SubscriptionEntity[]> {
    const where = and(
      filters.customerIdEq ? eq(subscriptions.customerId, filters.customerIdEq) : undefined,
      filters.statusEq ? eq(subscriptions.status, filters.statusEq) : undefined,
      filters.statusNe ? ne(subscriptions.status, filters.statusNe) : undefined,
      filters.testClockIdEq ? eq(subscriptions.testClockId, filters.testClockIdEq) : undefined,
      filters.currentPeriodEndLte
        ? lte(subscriptions.currentPeriodEnd, filters.currentPeriodEndLte)
        : undefined,
      filters.beforeCursor
        ? sql`(${subscriptions.createdAt}, ${subscriptions.id}) < (${filters.beforeCursor.createdAt.toISOString()}::timestamptz, ${filters.beforeCursor.id})`
        : undefined,
      filters.afterCursor
        ? sql`(${subscriptions.createdAt}, ${subscriptions.id}) > (${filters.afterCursor.createdAt.toISOString()}::timestamptz, ${filters.afterCursor.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(subscriptions)
      .where(where)
      .orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
      .limit(limit);
  }

  async findSubscriptionItems(
    subscriptionIds: readonly string[],
  ): Promise<SubscriptionItemEntity[]> {
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
    payload: NewSubscriptionEntity,
    items: readonly NewSubscriptionItemEntity[],
    executor?: DatabaseTransaction,
  ): Promise<SubscriptionEntity | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [subscription] = await db.insert(subscriptions).values(payload).returning();

    await db.insert(subscriptionItems).values([...items]);

    return subscription ?? null;
  }

  async updateSubscription(
    id: string,
    payload: Partial<NewSubscriptionEntity>,
    executor?: DatabaseTransaction,
  ): Promise<SubscriptionEntity | null> {
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
    items: readonly NewSubscriptionItemEntity[],
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
