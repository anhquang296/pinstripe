import type { PspProvider } from '@contracts/payments.types';
import type { NewPspEvent, PspEvent } from '@database/schemas';
import { pspEvents } from '@database/schemas';
import type { DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import { and, eq } from 'drizzle-orm';

export class PspEventRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findPspEvent(provider: PspProvider, eventId: string): Promise<PspEvent | null> {
    const [pspEvent] = await this._db.master
      .select()
      .from(pspEvents)
      .where(and(eq(pspEvents.provider, provider), eq(pspEvents.eventId, eventId)))
      .limit(1);

    return pspEvent ?? null;
  }

  async createPspEvent(
    payload: NewPspEvent,
    executor?: DatabaseTransaction,
  ): Promise<PspEvent | null> {
    const db = executor ?? this._db.master;

    const [pspEvent] = await db
      .insert(pspEvents)
      .values(payload)
      .onConflictDoNothing({ target: [pspEvents.provider, pspEvents.eventId] })
      .returning();

    return pspEvent ?? null;
  }
}
