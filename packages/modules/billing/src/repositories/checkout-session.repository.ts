import type { CheckoutSessionStatus } from '@contracts/checkout.types';
import type {
  CheckoutSession,
  CheckoutSessionLineItem,
  NewCheckoutSession,
  NewCheckoutSessionLineItem,
} from '@database/schemas';
import { checkoutSessionLineItems, checkoutSessions } from '@database/schemas';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import { NotFoundError } from '@vxrerp/platform/errors';
import type { RowCursor } from '@vxrerp/platform/repositories';
import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm';

export interface CheckoutSessionFilters {
  customerId?: string;
  status?: CheckoutSessionStatus;
  expiresBeforeAt?: string;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class CheckoutSessionRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getCheckoutSession(id: string): Promise<CheckoutSession> {
    const checkoutSession = await this.findCheckoutSession(id);

    if (checkoutSession) {
      return checkoutSession;
    }

    throw new NotFoundError(`No such checkout session: ${id}`);
  }

  async findCheckoutSession(id: string): Promise<CheckoutSession | null> {
    const [checkoutSession] = await this._db.master
      .select()
      .from(checkoutSessions)
      .where(eq(checkoutSessions.id, id))
      .limit(1);

    return checkoutSession ?? null;
  }

  async findCheckoutSessions(
    filters: CheckoutSessionFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<CheckoutSession[]> {
    const where = and(
      filters.customerId ? eq(checkoutSessions.customerId, filters.customerId) : undefined,
      filters.status ? eq(checkoutSessions.status, filters.status) : undefined,
      filters.expiresBeforeAt
        ? lte(checkoutSessions.expiresAt, filters.expiresBeforeAt)
        : undefined,
      filters.beforeAt
        ? sql`(${checkoutSessions.createdAt}, ${checkoutSessions.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${checkoutSessions.createdAt}, ${checkoutSessions.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(checkoutSessions)
      .where(where)
      .orderBy(desc(checkoutSessions.createdAt), desc(checkoutSessions.id))
      .limit(limit);
  }

  async createCheckoutSession(
    payload: NewCheckoutSession,
    executor?: DatabaseTransaction,
  ): Promise<CheckoutSession | null> {
    const db = executor ?? this._db.master;

    const [checkoutSession] = await db.insert(checkoutSessions).values(payload).returning();

    return checkoutSession ?? null;
  }

  async updateCheckoutSession(
    id: string,
    payload: Partial<NewCheckoutSession>,
    executor?: DatabaseTransaction,
  ): Promise<CheckoutSession | null> {
    const db = executor ?? this._db.master;

    const [checkoutSession] = await db
      .update(checkoutSessions)
      .set(payload)
      .where(eq(checkoutSessions.id, id))
      .returning();

    return checkoutSession ?? null;
  }

  async createCheckoutSessionLineItems(
    payloads: readonly NewCheckoutSessionLineItem[],
    executor?: DatabaseTransaction,
  ): Promise<void> {
    if (payloads.length === 0) {
      return;
    }

    const db = executor ?? this._db.master;

    await db.insert(checkoutSessionLineItems).values([...payloads]);
  }

  async findCheckoutSessionLineItems(
    checkoutSessionIds: readonly string[],
  ): Promise<CheckoutSessionLineItem[]> {
    if (checkoutSessionIds.length === 0) {
      return [];
    }

    return this._db.master
      .select()
      .from(checkoutSessionLineItems)
      .where(inArray(checkoutSessionLineItems.checkoutSessionId, [...checkoutSessionIds]))
      .orderBy(asc(checkoutSessionLineItems.createdAt), asc(checkoutSessionLineItems.id));
  }
}
