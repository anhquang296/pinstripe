import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewPriceEntity, PriceEntity } from '@database/schemas';
import { prices } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';

export interface FindPricesFilters {
  idIn?: readonly string[];
  productIdEq?: string;
  lookupKeyEq?: string;
  activeEq?: boolean;
  beforeCursor?: RowCursor;
  afterCursor?: RowCursor;
}

export class PriceRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findPrice(id: string): Promise<PriceEntity | null> {
    const [price] = await this._db.master.select().from(prices).where(eq(prices.id, id)).limit(1);

    return price ?? null;
  }

  async findPrices(filters: FindPricesFilters, limit: number): Promise<PriceEntity[]> {
    const where = and(
      filters.idIn ? inArray(prices.id, [...filters.idIn]) : undefined,
      filters.productIdEq ? eq(prices.productId, filters.productIdEq) : undefined,
      filters.lookupKeyEq ? eq(prices.lookupKey, filters.lookupKeyEq) : undefined,
      filters.activeEq === undefined ? undefined : eq(prices.active, filters.activeEq),
      filters.beforeCursor
        ? sql`(${prices.createdAt}, ${prices.id}) < (${filters.beforeCursor.createdAt.toISOString()}::timestamptz, ${filters.beforeCursor.id})`
        : undefined,
      filters.afterCursor
        ? sql`(${prices.createdAt}, ${prices.id}) > (${filters.afterCursor.createdAt.toISOString()}::timestamptz, ${filters.afterCursor.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(prices)
      .where(where)
      .orderBy(desc(prices.createdAt), desc(prices.id))
      .limit(limit);
  }

  async findLatestPriceVersion(lookupKey: string): Promise<PriceEntity | null> {
    const [price] = await this._db.master
      .select()
      .from(prices)
      .where(eq(prices.lookupKey, lookupKey))
      .orderBy(desc(prices.version))
      .limit(1);

    return price ?? null;
  }

  async findEffectivePrice(lookupKey: string, at: Date): Promise<PriceEntity | null> {
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

  async createPrice(
    payload: NewPriceEntity,
    executor?: DatabaseTransaction,
  ): Promise<PriceEntity | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [price] = await db.insert(prices).values(payload).returning();

    return price ?? null;
  }

  async updatePrice(
    id: string,
    payload: Partial<NewPriceEntity>,
    executor?: DatabaseTransaction,
  ): Promise<PriceEntity | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [price] = await db.update(prices).set(payload).where(eq(prices.id, id)).returning();

    return price ?? null;
  }
}
