import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewTestClock, TestClock } from '@database/schemas';
import { testClocks } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { desc, eq, sql } from 'drizzle-orm';

export interface TestClockFilters {
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class TestClockRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findTestClock(id: string): Promise<TestClock | null> {
    const [clock] = await this._db.master
      .select()
      .from(testClocks)
      .where(eq(testClocks.id, id))
      .limit(1);

    return clock ?? null;
  }

  async findTestClocks(
    filters: TestClockFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<TestClock[]> {
    const where = filters.beforeAt
      ? sql`(${testClocks.createdAt}, ${testClocks.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
      : filters.afterAt
        ? sql`(${testClocks.createdAt}, ${testClocks.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined;

    return this._db.master
      .select()
      .from(testClocks)
      .where(where)
      .orderBy(desc(testClocks.createdAt), desc(testClocks.id))
      .limit(limit);
  }

  async createTestClock(
    payload: NewTestClock,
    executor?: DatabaseTransaction,
  ): Promise<TestClock | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [clock] = await db.insert(testClocks).values(payload).returning();

    return clock ?? null;
  }

  async updateTestClock(
    id: string,
    payload: Partial<NewTestClock>,
    executor?: DatabaseTransaction,
  ): Promise<TestClock | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [clock] = await db
      .update(testClocks)
      .set(payload)
      .where(eq(testClocks.id, id))
      .returning();

    return clock ?? null;
  }
}
