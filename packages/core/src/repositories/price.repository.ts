import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewPrice, Price } from '@database/schemas';
import { prices } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';

export interface PriceFilters {
  livemode?: boolean;
  ids?: readonly string[];
  productId?: string;
  lookupKey?: string;
  active?: boolean;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class PriceRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findPrice(id: string): Promise<Price | null> {
    const [price] = await this._db.master.select().from(prices).where(eq(prices.id, id)).limit(1);

    return price ?? null;
  }

  async findPrices(filters: PriceFilters = {}, limit = DEFAULT_QUERY_LIMIT): Promise<Price[]> {
    const where = and(
      filters.livemode === undefined ? undefined : eq(prices.livemode, filters.livemode),
      filters.ids ? inArray(prices.id, [...filters.ids]) : undefined,
      filters.productId ? eq(prices.productId, filters.productId) : undefined,
      filters.lookupKey ? eq(prices.lookupKey, filters.lookupKey) : undefined,
      filters.active === undefined ? undefined : eq(prices.active, filters.active),
      filters.beforeAt
        ? sql`(${prices.createdAt}, ${prices.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${prices.createdAt}, ${prices.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(prices)
      .where(where)
      .orderBy(desc(prices.createdAt), desc(prices.id))
      .limit(limit);
  }

  async findLatestPrice(lookupKey: string): Promise<Price | null> {
    const [price] = await this._db.master
      .select()
      .from(prices)
      .where(eq(prices.lookupKey, lookupKey))
      .orderBy(desc(prices.version))
      .limit(1);

    return price ?? null;
  }

  async findEffectivePrice(lookupKey: string, at: Date): Promise<Price | null> {
    const [price] = await this._db.master
      .select()
      .from(prices)
      .where(
        and(eq(prices.lookupKey, lookupKey), eq(prices.active, true), lte(prices.effectiveAt, at)),
      )
      .orderBy(desc(prices.effectiveAt), desc(prices.version))
      .limit(1);

    return price ?? null;
  }

  async createPrice(payload: NewPrice, executor?: DatabaseTransaction): Promise<Price | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [price] = await db.insert(prices).values(payload).returning();

    return price ?? null;
  }

  async updatePrice(
    id: string,
    payload: Partial<NewPrice>,
    executor?: DatabaseTransaction,
  ): Promise<Price | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [price] = await db.update(prices).set(payload).where(eq(prices.id, id)).returning();

    return price ?? null;
  }
}
