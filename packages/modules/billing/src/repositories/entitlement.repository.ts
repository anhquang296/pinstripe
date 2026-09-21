import type { EntitlementStatus } from '@contracts/entitlements.types';
import type { Entitlement, NewEntitlement } from '@database/schemas';
import { entitlements } from '@database/schemas';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { Database, DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import type { RowCursor } from '@vxrerp/platform/repositories';
import { and, desc, eq, sql } from 'drizzle-orm';

export interface EntitlementFilters {
  customerId?: string;
  productId?: string;
  subscriptionId?: string;
  status?: EntitlementStatus;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class EntitlementRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findEntitlements(
    filters: EntitlementFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<Entitlement[]> {
    const where = and(
      filters.customerId ? eq(entitlements.customerId, filters.customerId) : undefined,
      filters.productId ? eq(entitlements.productId, filters.productId) : undefined,
      filters.subscriptionId ? eq(entitlements.subscriptionId, filters.subscriptionId) : undefined,
      filters.status ? eq(entitlements.status, filters.status) : undefined,
      filters.beforeAt
        ? sql`(${entitlements.createdAt}, ${entitlements.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${entitlements.createdAt}, ${entitlements.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(entitlements)
      .where(where)
      .orderBy(desc(entitlements.createdAt), desc(entitlements.id))
      .limit(limit);
  }

  async upsertEntitlement(
    payload: NewEntitlement,
    executor?: DatabaseTransaction,
  ): Promise<Entitlement | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    const { status, revokedAt = null, updatedAt = new Date().toISOString() } = payload;

    const [entitlement] = await db
      .insert(entitlements)
      .values(payload)
      .onConflictDoUpdate({
        target: [entitlements.subscriptionId, entitlements.productId],
        set: { status, revokedAt, updatedAt },
      })
      .returning();

    return entitlement ?? null;
  }

  async revokeEntitlements(
    subscriptionId: string,
    status: EntitlementStatus,
    revokedAt: string,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(entitlements)
      .set({ status, revokedAt, updatedAt: revokedAt })
      .where(eq(entitlements.subscriptionId, subscriptionId));
  }
}
