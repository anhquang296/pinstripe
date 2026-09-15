import { and, desc, eq, sql } from 'drizzle-orm';
import type { EntitlementStatus } from '@contracts/entitlements.types';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { EntitlementEntity, NewEntitlementEntity } from '@database/schemas';
import { entitlements } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';

export interface FindEntitlementsFilters {
  customerIdEq?: string;
  productIdEq?: string;
  subscriptionIdEq?: string;
  statusEq?: EntitlementStatus;
  beforeCursor?: RowCursor;
  afterCursor?: RowCursor;
}

export class EntitlementRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findEntitlements(
    filters: FindEntitlementsFilters,
    limit: number,
  ): Promise<EntitlementEntity[]> {
    const where = and(
      filters.customerIdEq ? eq(entitlements.customerId, filters.customerIdEq) : undefined,
      filters.productIdEq ? eq(entitlements.productId, filters.productIdEq) : undefined,
      filters.subscriptionIdEq
        ? eq(entitlements.subscriptionId, filters.subscriptionIdEq)
        : undefined,
      filters.statusEq ? eq(entitlements.status, filters.statusEq) : undefined,
      filters.beforeCursor
        ? sql`(${entitlements.createdAt}, ${entitlements.id}) < (${filters.beforeCursor.createdAt.toISOString()}::timestamptz, ${filters.beforeCursor.id})`
        : undefined,
      filters.afterCursor
        ? sql`(${entitlements.createdAt}, ${entitlements.id}) > (${filters.afterCursor.createdAt.toISOString()}::timestamptz, ${filters.afterCursor.id})`
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
    payload: NewEntitlementEntity,
    executor?: DatabaseTransaction,
  ): Promise<EntitlementEntity | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [entitlement] = await db
      .insert(entitlements)
      .values(payload)
      .onConflictDoUpdate({
        target: [entitlements.subscriptionId, entitlements.productId],
        set: {
          status: payload.status,
          revokedAt: payload.revokedAt ?? null,
          updatedAt: payload.updatedAt ?? new Date(),
        },
      })
      .returning();

    return entitlement ?? null;
  }

  async revokeEntitlements(
    subscriptionId: string,
    status: EntitlementStatus,
    revokedAt: Date,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(entitlements)
      .set({ status, revokedAt, updatedAt: revokedAt })
      .where(eq(entitlements.subscriptionId, subscriptionId));
  }
}
