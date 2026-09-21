import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { DatabaseClient } from '@database/database.client';
import type { ApiKey, NewApiKey } from '@database/schemas';
import { apiKeys } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

export interface ApiKeyFilters {
  tokenHash?: string;
  revokedAtIsNull?: boolean;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class ApiKeyRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getApiKey(id: string): Promise<ApiKey> {
    const apiKey = await this.findApiKey(id);

    if (apiKey) {
      return apiKey;
    }

    throw new NotFoundError(`No such api key: ${id}`);
  }

  async findApiKey(id: string): Promise<ApiKey | null> {
    const [apiKey] = await this._db.master
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    return apiKey ?? null;
  }

  async findApiKeys(filters: ApiKeyFilters = {}, limit = DEFAULT_QUERY_LIMIT): Promise<ApiKey[]> {
    const where = and(
      filters.tokenHash ? eq(apiKeys.tokenHash, filters.tokenHash) : undefined,
      filters.revokedAtIsNull ? isNull(apiKeys.revokedAt) : undefined,
      filters.beforeAt
        ? sql`(${apiKeys.createdAt}, ${apiKeys.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${apiKeys.createdAt}, ${apiKeys.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(apiKeys)
      .where(where)
      .orderBy(desc(apiKeys.createdAt), desc(apiKeys.id))
      .limit(limit);
  }

  async createApiKey(payload: NewApiKey): Promise<ApiKey | null> {
    const [apiKey] = await this._db.master
      .insert(apiKeys)
      .values(payload)
      .onConflictDoNothing({ target: apiKeys.tokenHash })
      .returning();

    return apiKey ?? null;
  }

  async updateApiKey(id: string, payload: Partial<NewApiKey>): Promise<ApiKey | null> {
    const [apiKey] = await this._db.master
      .update(apiKeys)
      .set(payload)
      .where(eq(apiKeys.id, id))
      .returning();

    return apiKey ?? null;
  }
}
