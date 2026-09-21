import type { NewTaxId, TaxId } from '@database/schemas';
import { taxIds } from '@database/schemas';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { Database, DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import { NotFoundError } from '@vxrerp/platform/errors';
import type { RowCursor } from '@vxrerp/platform/repositories';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

export interface TaxIdFilters {
  customerId?: string;
  customerIds?: readonly string[];
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class TaxIdRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getTaxId(id: string): Promise<TaxId> {
    const taxId = await this.findTaxId(id);

    if (taxId) {
      return taxId;
    }

    throw new NotFoundError(`No such tax id: ${id}`);
  }

  async findTaxId(id: string): Promise<TaxId | null> {
    const [taxId] = await this._db.master
      .select()
      .from(taxIds)
      .where(and(eq(taxIds.id, id), isNull(taxIds.deletedAt)))
      .limit(1);

    return taxId ?? null;
  }

  async findTaxIds(filters: TaxIdFilters = {}, limit = DEFAULT_QUERY_LIMIT): Promise<TaxId[]> {
    const where = and(
      isNull(taxIds.deletedAt),
      filters.customerId ? eq(taxIds.customerId, filters.customerId) : undefined,
      filters.customerIds ? inArray(taxIds.customerId, [...filters.customerIds]) : undefined,
      filters.beforeAt
        ? sql`(${taxIds.createdAt}, ${taxIds.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${taxIds.createdAt}, ${taxIds.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(taxIds)
      .where(where)
      .orderBy(asc(taxIds.createdAt), asc(taxIds.id))
      .limit(limit);
  }

  async createTaxId(payload: NewTaxId, executor?: DatabaseTransaction): Promise<TaxId | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    const [taxId] = await db.insert(taxIds).values(payload).returning();

    return taxId ?? null;
  }

  async updateTaxId(
    id: string,
    payload: Partial<NewTaxId>,
    executor?: DatabaseTransaction,
  ): Promise<TaxId | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    const [taxId] = await db
      .update(taxIds)
      .set(payload)
      .where(and(eq(taxIds.id, id), isNull(taxIds.deletedAt)))
      .returning();

    return taxId ?? null;
  }

  async archiveTaxId(id: string, deletedAt: string, executor?: DatabaseTransaction): Promise<void> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(taxIds)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(taxIds.id, id), isNull(taxIds.deletedAt)));
  }
}
