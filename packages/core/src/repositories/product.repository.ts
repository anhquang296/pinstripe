import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewProductEntity, ProductEntity } from '@database/schemas';
import { products } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';

export interface FindProductsFilters {
  activeEq?: boolean;
  beforeCursor?: RowCursor;
  afterCursor?: RowCursor;
}

export class ProductRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findProduct(id: string): Promise<ProductEntity | null> {
    const [product] = await this._db.master
      .select()
      .from(products)
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .limit(1);

    return product ?? null;
  }

  async findProducts(filters: FindProductsFilters, limit: number): Promise<ProductEntity[]> {
    const where = and(
      isNull(products.deletedAt),
      filters.activeEq === undefined ? undefined : eq(products.active, filters.activeEq),
      filters.beforeCursor
        ? sql`(${products.createdAt}, ${products.id}) < (${filters.beforeCursor.createdAt.toISOString()}::timestamptz, ${filters.beforeCursor.id})`
        : undefined,
      filters.afterCursor
        ? sql`(${products.createdAt}, ${products.id}) > (${filters.afterCursor.createdAt.toISOString()}::timestamptz, ${filters.afterCursor.id})`
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
    payload: NewProductEntity,
    executor?: DatabaseTransaction,
  ): Promise<ProductEntity | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [product] = await db.insert(products).values(payload).returning();

    return product ?? null;
  }

  async updateProduct(
    id: string,
    payload: Partial<NewProductEntity>,
    executor?: DatabaseTransaction,
  ): Promise<ProductEntity | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [product] = await db
      .update(products)
      .set(payload)
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .returning();

    return product ?? null;
  }
}
