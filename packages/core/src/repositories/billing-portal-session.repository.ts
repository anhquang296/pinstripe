import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { BillingPortalSession, NewBillingPortalSession } from '@database/schemas';
import { billingPortalSessions } from '@database/schemas';
import { and, desc, eq } from 'drizzle-orm';

export interface BillingPortalSessionFilters {
  livemode?: boolean;
  customerId?: string;
}

export class BillingPortalSessionRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findBillingPortalSession(id: string): Promise<BillingPortalSession | null> {
    const [session] = await this._db.master
      .select()
      .from(billingPortalSessions)
      .where(eq(billingPortalSessions.id, id))
      .limit(1);

    return session ?? null;
  }

  async findBillingPortalSessions(
    filters: BillingPortalSessionFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<BillingPortalSession[]> {
    const where = and(
      filters.livemode === undefined
        ? undefined
        : eq(billingPortalSessions.livemode, filters.livemode),
      filters.customerId ? eq(billingPortalSessions.customerId, filters.customerId) : undefined,
    );

    return this._db.master
      .select()
      .from(billingPortalSessions)
      .where(where)
      .orderBy(desc(billingPortalSessions.createdAt), desc(billingPortalSessions.id))
      .limit(limit);
  }

  async createBillingPortalSession(
    payload: NewBillingPortalSession,
    executor?: DatabaseTransaction,
  ): Promise<BillingPortalSession | null> {
    const db = executor ?? this._db.master;
    const [session] = await db.insert(billingPortalSessions).values(payload).returning();

    return session ?? null;
  }
}
