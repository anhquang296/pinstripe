import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewProduct, Product } from '@database/schemas';
import { products } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

export interface ProductFilters {
  livemode?: boolean;
  ids?: readonly string[];
  active?: boolean;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class ProductRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findProduct(id: string): Promise<Product | null> {
    const [product] = await this._db.master
      .select()
      .from(products)
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .limit(1);

    return product ?? null;
  }

  async findProducts(
    filters: ProductFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<Product[]> {
    const where = and(
      isNull(products.deletedAt),
      filters.livemode === undefined ? undefined : eq(products.livemode, filters.livemode),
      filters.ids ? inArray(products.id, [...filters.ids]) : undefined,
      filters.active === undefined ? undefined : eq(products.active, filters.active),
      filters.beforeAt
        ? sql`(${products.createdAt}, ${products.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${products.createdAt}, ${products.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(limit);
  }

  async createProduct(
    payload: NewProduct,
    executor?: DatabaseTransaction,
  ): Promise<Product | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [product] = await db.insert(products).values(payload).returning();

    return product ?? null;
  }

  async updateProduct(
    id: string,
    payload: Partial<NewProduct>,
    executor?: DatabaseTransaction,
  ): Promise<Product | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [product] = await db
      .update(products)
      .set(payload)
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .returning();

    return product ?? null;
  }
}
