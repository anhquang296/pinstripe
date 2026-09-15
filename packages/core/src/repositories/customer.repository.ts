import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { CustomerEntity, NewCustomerEntity } from '@database/schemas';
import { customers } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';

export interface FindCustomersFilters {
  emailEq?: string;
  beforeCursor?: RowCursor;
  afterCursor?: RowCursor;
}

export class CustomerRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findCustomer(id: string): Promise<CustomerEntity | null> {
    const [customer] = await this._db.master
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .limit(1);

    return customer ?? null;
  }

  async findCustomers(filters: FindCustomersFilters, limit: number): Promise<CustomerEntity[]> {
    const where = and(
      isNull(customers.deletedAt),
      filters.emailEq ? eq(customers.email, filters.emailEq) : undefined,
      filters.beforeCursor
        ? sql`(${customers.createdAt}, ${customers.id}) < (${filters.beforeCursor.createdAt.toISOString()}::timestamptz, ${filters.beforeCursor.id})`
        : undefined,
      filters.afterCursor
        ? sql`(${customers.createdAt}, ${customers.id}) > (${filters.afterCursor.createdAt.toISOString()}::timestamptz, ${filters.afterCursor.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt), desc(customers.id))
      .limit(limit);
  }

  async createCustomer(
    payload: NewCustomerEntity,
    executor?: DatabaseTransaction,
  ): Promise<CustomerEntity | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [customer] = await db.insert(customers).values(payload).returning();

    return customer ?? null;
  }

  async updateCustomer(
    id: string,
    payload: Partial<NewCustomerEntity>,
    executor?: DatabaseTransaction,
  ): Promise<CustomerEntity | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [customer] = await db
      .update(customers)
      .set(payload)
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .returning();

    return customer ?? null;
  }

  async softDeleteCustomer(
    id: string,
    deletedAt: Date,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(customers)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)));
  }
}
