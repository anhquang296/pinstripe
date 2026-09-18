import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { Customer, NewCustomer } from '@database/schemas';
import { customers } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

export interface CustomerFilters {
  ids?: readonly string[];
  email?: string;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class CustomerRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getCustomer(id: string): Promise<Customer> {
    const customer = await this.findCustomer(id);

    if (customer) {
      return customer;
    }

    throw new NotFoundError(`No such customer: ${id}`);
  }

  async findCustomer(id: string): Promise<Customer | null> {
    const [customer] = await this._db.master
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .limit(1);

    return customer ?? null;
  }

  async findCustomers(
    filters: CustomerFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<Customer[]> {
    const where = and(
      isNull(customers.deletedAt),
      filters.ids ? inArray(customers.id, [...filters.ids]) : undefined,
      filters.email ? eq(customers.email, filters.email) : undefined,
      filters.beforeAt
        ? sql`(${customers.createdAt}, ${customers.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${customers.createdAt}, ${customers.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt), desc(customers.id))
      .limit(limit);
  }

  async getLockedCustomer(id: string, executor: DatabaseTransaction): Promise<Customer> {
    const [customer] = await executor
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .limit(1)
      .for('update');

    if (customer) {
      return customer;
    }

    throw new NotFoundError(`No such customer: ${id}`);
  }

  async createCustomer(
    payload: NewCustomer,
    executor?: DatabaseTransaction,
  ): Promise<Customer | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [customer] = await db.insert(customers).values(payload).returning();

    return customer ?? null;
  }

  async updateCustomer(
    id: string,
    payload: Partial<NewCustomer>,
    executor?: DatabaseTransaction,
  ): Promise<Customer | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [customer] = await db
      .update(customers)
      .set(payload)
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .returning();

    return customer ?? null;
  }

  async archiveCustomer(
    id: string,
    deletedAt: string,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(customers)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)));
  }
}
