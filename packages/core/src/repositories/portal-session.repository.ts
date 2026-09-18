import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { PortalSessionStatus } from '@contracts/portal.types';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewPortalSession, PortalSession } from '@database/schemas';
import { portalSessions } from '@database/schemas';
import { and, desc, eq } from 'drizzle-orm';

export interface PortalSessionFilters {
  livemode?: boolean;
  customerId?: string;
  status?: PortalSessionStatus;
  linkTokenHash?: string;
  sessionTokenHash?: string;
}

export class PortalSessionRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findPortalSession(id: string): Promise<PortalSession | null> {
    const [portalSession] = await this._db.master
      .select()
      .from(portalSessions)
      .where(eq(portalSessions.id, id))
      .limit(1);

    return portalSession ?? null;
  }

  async findPortalSessions(
    filters: PortalSessionFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<PortalSession[]> {
    const where = and(
      filters.livemode === undefined ? undefined : eq(portalSessions.livemode, filters.livemode),
      filters.customerId ? eq(portalSessions.customerId, filters.customerId) : undefined,
      filters.status ? eq(portalSessions.status, filters.status) : undefined,
      filters.linkTokenHash ? eq(portalSessions.linkTokenHash, filters.linkTokenHash) : undefined,
      filters.sessionTokenHash
        ? eq(portalSessions.sessionTokenHash, filters.sessionTokenHash)
        : undefined,
    );

    return this._db.master
      .select()
      .from(portalSessions)
      .where(where)
      .orderBy(desc(portalSessions.createdAt), desc(portalSessions.id))
      .limit(limit);
  }

  async createPortalSession(
    payload: NewPortalSession,
    executor?: DatabaseTransaction,
  ): Promise<PortalSession | null> {
    const db = executor ?? this._db.master;
    const [portalSession] = await db.insert(portalSessions).values(payload).returning();

    return portalSession ?? null;
  }

  async updatePortalSession(
    id: string,
    payload: Partial<NewPortalSession>,
    executor?: DatabaseTransaction,
  ): Promise<PortalSession | null> {
    const db = executor ?? this._db.master;
    const [portalSession] = await db
      .update(portalSessions)
      .set(payload)
      .where(eq(portalSessions.id, id))
      .returning();

    return portalSession ?? null;
  }
}
