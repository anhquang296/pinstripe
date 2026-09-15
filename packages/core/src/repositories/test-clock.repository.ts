import { desc, eq, sql } from 'drizzle-orm';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewTestClockEntity, TestClockEntity } from '@database/schemas';
import { testClocks } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';

export interface FindTestClocksFilters {
  beforeCursor?: RowCursor;
  afterCursor?: RowCursor;
}

export class TestClockRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findTestClock(id: string): Promise<TestClockEntity | null> {
    const [clock] = await this._db.master
      .select()
      .from(testClocks)
      .where(eq(testClocks.id, id))
      .limit(1);

    return clock ?? null;
  }

  async findTestClocks(filters: FindTestClocksFilters, limit: number): Promise<TestClockEntity[]> {
    const where = filters.beforeCursor
      ? sql`(${testClocks.createdAt}, ${testClocks.id}) < (${filters.beforeCursor.createdAt.toISOString()}::timestamptz, ${filters.beforeCursor.id})`
      : filters.afterCursor
        ? sql`(${testClocks.createdAt}, ${testClocks.id}) > (${filters.afterCursor.createdAt.toISOString()}::timestamptz, ${filters.afterCursor.id})`
        : undefined;

    return this._db.master
      .select()
      .from(testClocks)
      .where(where)
      .orderBy(desc(testClocks.createdAt), desc(testClocks.id))
      .limit(limit);
  }

  async createTestClock(
    payload: NewTestClockEntity,
    executor?: DatabaseTransaction,
  ): Promise<TestClockEntity | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [clock] = await db.insert(testClocks).values(payload).returning();

    return clock ?? null;
  }

  async updateTestClock(
    id: string,
    payload: Partial<NewTestClockEntity>,
    executor?: DatabaseTransaction,
  ): Promise<TestClockEntity | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [clock] = await db
      .update(testClocks)
      .set(payload)
      .where(eq(testClocks.id, id))
      .returning();

    return clock ?? null;
  }
}
