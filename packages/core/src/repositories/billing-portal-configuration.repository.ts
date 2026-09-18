import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { BillingPortalConfiguration, NewBillingPortalConfiguration } from '@database/schemas';
import { billingPortalConfigurations } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, desc, eq, sql } from 'drizzle-orm';

export interface BillingPortalConfigurationFilters {
  livemode?: boolean;
  isActive?: boolean;
  isDefault?: boolean;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class BillingPortalConfigurationRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findBillingPortalConfiguration(id: string): Promise<BillingPortalConfiguration | null> {
    const [configuration] = await this._db.master
      .select()
      .from(billingPortalConfigurations)
      .where(eq(billingPortalConfigurations.id, id))
      .limit(1);

    return configuration ?? null;
  }

  async findBillingPortalConfigurations(
    filters: BillingPortalConfigurationFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<BillingPortalConfiguration[]> {
    const where = and(
      filters.livemode === undefined
        ? undefined
        : eq(billingPortalConfigurations.livemode, filters.livemode),
      filters.isActive === undefined
        ? undefined
        : eq(billingPortalConfigurations.isActive, filters.isActive),
      filters.isDefault === undefined
        ? undefined
        : eq(billingPortalConfigurations.isDefault, filters.isDefault),
      filters.beforeAt
        ? sql`(${billingPortalConfigurations.createdAt}, ${billingPortalConfigurations.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${billingPortalConfigurations.createdAt}, ${billingPortalConfigurations.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(billingPortalConfigurations)
      .where(where)
      .orderBy(desc(billingPortalConfigurations.createdAt), desc(billingPortalConfigurations.id))
      .limit(limit);
  }

  async createBillingPortalConfiguration(
    payload: NewBillingPortalConfiguration,
    executor?: DatabaseTransaction,
  ): Promise<BillingPortalConfiguration | null> {
    const db = executor ?? this._db.master;
    const [configuration] = await db
      .insert(billingPortalConfigurations)
      .values(payload)
      .returning();

    return configuration ?? null;
  }

  async updateBillingPortalConfiguration(
    id: string,
    payload: Partial<NewBillingPortalConfiguration>,
    executor?: DatabaseTransaction,
  ): Promise<BillingPortalConfiguration | null> {
    const db = executor ?? this._db.master;
    const [configuration] = await db
      .update(billingPortalConfigurations)
      .set(payload)
      .where(eq(billingPortalConfigurations.id, id))
      .returning();

    return configuration ?? null;
  }

  async demoteBillingPortalConfigurations(
    livemode: boolean,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    const db = executor ?? this._db.master;

    await db
      .update(billingPortalConfigurations)
      .set({ isDefault: false })
      .where(
        and(
          eq(billingPortalConfigurations.livemode, livemode),
          eq(billingPortalConfigurations.isDefault, true),
        ),
      );
  }
}
