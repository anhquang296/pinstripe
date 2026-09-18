import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { SetupIntentStatus } from '@contracts/setup-intents.types';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewSetupIntent, SetupIntent } from '@database/schemas';
import { setupIntents } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { and, desc, eq, sql } from 'drizzle-orm';

export interface SetupIntentFilters {
  customerId?: string;
  status?: SetupIntentStatus;
  pspReference?: string;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class SetupIntentRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getSetupIntent(id: string): Promise<SetupIntent> {
    const setupIntent = await this.findSetupIntent(id);

    if (setupIntent) {
      return setupIntent;
    }

    throw new NotFoundError(`No such setup intent: ${id}`);
  }

  async findSetupIntent(id: string): Promise<SetupIntent | null> {
    const [setupIntent] = await this._db.master
      .select()
      .from(setupIntents)
      .where(eq(setupIntents.id, id))
      .limit(1);

    return setupIntent ?? null;
  }

  async findSetupIntents(
    filters: SetupIntentFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<SetupIntent[]> {
    const where = and(
      filters.customerId ? eq(setupIntents.customerId, filters.customerId) : undefined,
      filters.status ? eq(setupIntents.status, filters.status) : undefined,
      filters.pspReference ? eq(setupIntents.pspReference, filters.pspReference) : undefined,
      filters.beforeAt
        ? sql`(${setupIntents.createdAt}, ${setupIntents.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${setupIntents.createdAt}, ${setupIntents.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(setupIntents)
      .where(where)
      .orderBy(desc(setupIntents.createdAt), desc(setupIntents.id))
      .limit(limit);
  }

  async createSetupIntent(
    payload: NewSetupIntent,
    executor?: DatabaseTransaction,
  ): Promise<SetupIntent | null> {
    const db = executor ?? this._db.master;
    const [setupIntent] = await db.insert(setupIntents).values(payload).returning();

    return setupIntent ?? null;
  }

  async updateSetupIntent(
    id: string,
    payload: Partial<NewSetupIntent>,
    executor?: DatabaseTransaction,
  ): Promise<SetupIntent | null> {
    const db = executor ?? this._db.master;
    const [setupIntent] = await db
      .update(setupIntents)
      .set(payload)
      .where(eq(setupIntents.id, id))
      .returning();

    return setupIntent ?? null;
  }
}
