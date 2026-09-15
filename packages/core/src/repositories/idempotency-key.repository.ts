import { and, eq, lt } from 'drizzle-orm';
import type { DatabaseClient } from '@database/database.client';
import type { IdempotencyKey, IdempotencyStatus, NewIdempotencyKey } from '@database/schemas';
import { IdempotencyStatusEnum, idempotencyKeys } from '@database/schemas';

export class IdempotencyKeyRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findIdempotencyKey(scope: string, key: string, route: string): Promise<IdempotencyKey | null> {
    const [record] = await this._db.master
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.scope, scope),
          eq(idempotencyKeys.key, key),
          eq(idempotencyKeys.route, route),
        ),
      )
      .limit(1);

    return record ?? null;
  }

  async createIdempotencyKey(payload: NewIdempotencyKey): Promise<IdempotencyKey | null> {
    const [record] = await this._db.master
      .insert(idempotencyKeys)
      .values(payload)
      .onConflictDoNothing()
      .returning();

    return record ?? null;
  }

  async completeIdempotencyKey(
    id: string,
    status: IdempotencyStatus,
    responseStatusCode: number,
    responseBody: unknown,
  ): Promise<void> {
    await this._db.master
      .update(idempotencyKeys)
      .set({ status, responseStatusCode, responseBody, updatedAt: new Date() })
      .where(eq(idempotencyKeys.id, id));
  }

  async releaseIdempotencyKey(id: string): Promise<void> {
    await this._db.master
      .update(idempotencyKeys)
      .set({ status: IdempotencyStatusEnum.FAILED, lockedAt: null, updatedAt: new Date() })
      .where(eq(idempotencyKeys.id, id));
  }

  async deleteExpiredIdempotencyKeys(before: Date): Promise<void> {
    await this._db.master.delete(idempotencyKeys).where(lt(idempotencyKeys.expiresAt, before));
  }
}
