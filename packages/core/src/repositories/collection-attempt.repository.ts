import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { CollectionAttemptStatus } from '@contracts/collection-attempts.types';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { CollectionAttempt, NewCollectionAttempt } from '@database/schemas';
import { collectionAttempts } from '@database/schemas';
import { and, desc, eq } from 'drizzle-orm';

export interface CollectionAttemptFilters {
  invoiceId?: string;
  status?: CollectionAttemptStatus;
}

export class CollectionAttemptRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findCollectionAttempts(
    filters: CollectionAttemptFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<CollectionAttempt[]> {
    const where = and(
      filters.invoiceId ? eq(collectionAttempts.invoiceId, filters.invoiceId) : undefined,
      filters.status ? eq(collectionAttempts.status, filters.status) : undefined,
    );

    return this._db.master
      .select()
      .from(collectionAttempts)
      .where(where)
      .orderBy(desc(collectionAttempts.createdAt), desc(collectionAttempts.id))
      .limit(limit);
  }

  async createCollectionAttempt(
    payload: NewCollectionAttempt,
    executor?: DatabaseTransaction,
  ): Promise<CollectionAttempt | null> {
    const db = executor ?? this._db.master;
    const [collectionAttempt] = await db.insert(collectionAttempts).values(payload).returning();

    return collectionAttempt ?? null;
  }

  async updateCollectionAttempt(
    id: string,
    payload: Partial<NewCollectionAttempt>,
    executor?: DatabaseTransaction,
  ): Promise<CollectionAttempt | null> {
    const db = executor ?? this._db.master;
    const [collectionAttempt] = await db
      .update(collectionAttempts)
      .set(payload)
      .where(eq(collectionAttempts.id, id))
      .returning();

    return collectionAttempt ?? null;
  }
}
