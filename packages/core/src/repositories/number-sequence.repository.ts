import type { NumberSequence } from '@contracts/invoices.types';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import { numberSequences } from '@database/schemas';
import { eq, sql } from 'drizzle-orm';

export class NumberSequenceRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async claimNumberSequence(
    name: NumberSequence,
    executor?: DatabaseTransaction,
  ): Promise<number | null> {
    const db = executor ?? this._db.master;
    const [claimed] = await db
      .update(numberSequences)
      .set({ nextValue: sql`${numberSequences.nextValue} + 1` })
      .where(eq(numberSequences.name, name))
      .returning({ nextValue: numberSequences.nextValue });

    return claimed ? claimed.nextValue - 1 : null;
  }
}
