import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { TaxType } from '@contracts/taxes.types';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewTaxRate, TaxRate } from '@database/schemas';
import { taxRates } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

export interface TaxRateFilters {
  ids?: readonly string[];
  active?: boolean;
  inclusive?: boolean;
  country?: string;
  state?: string;
  stateIsNull?: boolean;
  taxType?: TaxType;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class TaxRateRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getTaxRate(id: string): Promise<TaxRate> {
    const taxRate = await this.findTaxRate(id);

    if (taxRate) {
      return taxRate;
    }

    throw new NotFoundError(`No such tax rate: ${id}`);
  }

  async findTaxRate(id: string): Promise<TaxRate | null> {
    const [taxRate] = await this._db.master
      .select()
      .from(taxRates)
      .where(eq(taxRates.id, id))
      .limit(1);

    return taxRate ?? null;
  }

  async findTaxRates(
    filters: TaxRateFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<TaxRate[]> {
    const where = and(
      filters.ids ? inArray(taxRates.id, [...filters.ids]) : undefined,
      filters.active === undefined ? undefined : eq(taxRates.active, filters.active),
      filters.inclusive === undefined ? undefined : eq(taxRates.inclusive, filters.inclusive),
      filters.country ? eq(taxRates.country, filters.country) : undefined,
      filters.state ? eq(taxRates.state, filters.state) : undefined,
      filters.stateIsNull ? isNull(taxRates.state) : undefined,
      filters.taxType ? eq(taxRates.taxType, filters.taxType) : undefined,
      filters.beforeAt
        ? sql`(${taxRates.createdAt}, ${taxRates.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${taxRates.createdAt}, ${taxRates.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(taxRates)
      .where(where)
      .orderBy(asc(taxRates.createdAt), asc(taxRates.id))
      .limit(limit);
  }

  async findJurisdictionTaxRates(
    country: string,
    state: string | null,
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<TaxRate[]> {
    const where = and(
      eq(taxRates.active, true),
      eq(taxRates.country, country),
      state ? or(isNull(taxRates.state), eq(taxRates.state, state)) : isNull(taxRates.state),
    );

    return this._db.master
      .select()
      .from(taxRates)
      .where(where)
      .orderBy(asc(taxRates.createdAt), asc(taxRates.id))
      .limit(limit);
  }

  async createTaxRate(
    payload: NewTaxRate,
    executor?: DatabaseTransaction,
  ): Promise<TaxRate | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [taxRate] = await db.insert(taxRates).values(payload).returning();

    return taxRate ?? null;
  }

  async updateTaxRate(
    id: string,
    payload: Partial<NewTaxRate>,
    executor?: DatabaseTransaction,
  ): Promise<TaxRate | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [taxRate] = await db.update(taxRates).set(payload).where(eq(taxRates.id, id)).returning();

    return taxRate ?? null;
  }
}
