import type { NewTestClock, TestClock } from '@database/schemas';
import { testClocks } from '@database/schemas';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { Database, DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import { NotFoundError } from '@vxrerp/platform/errors';
import type { RowCursor } from '@vxrerp/platform/repositories';
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

  async getTestClock(id: string): Promise<TestClock> {
    const testClock = await this.findTestClock(id);

    if (testClock) {
      return testClock;
    }

    throw new NotFoundError(`No such test clock: ${id}`);
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
      ? sql`(${testClocks.createdAt}, ${testClocks.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
      : filters.afterAt
        ? sql`(${testClocks.createdAt}, ${testClocks.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
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
