import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { CreditNote, NewCreditNote } from '@database/schemas';
import { creditNotes } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface InvoiceCreditedAmount {
  invoiceId: string;
  creditedAmount: number;
}

export interface CreditNoteFilters {
  invoiceId?: string;
  customerId?: string;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class CreditNoteRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findCreditNote(id: string): Promise<CreditNote | null> {
    const [creditNote] = await this._db.master
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.id, id))
      .limit(1);

    return creditNote ?? null;
  }

  async findCreditNotes(
    filters: CreditNoteFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<CreditNote[]> {
    const where = and(
      filters.invoiceId ? eq(creditNotes.invoiceId, filters.invoiceId) : undefined,
      filters.customerId ? eq(creditNotes.customerId, filters.customerId) : undefined,
      filters.beforeAt
        ? sql`(${creditNotes.createdAt}, ${creditNotes.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${creditNotes.createdAt}, ${creditNotes.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(creditNotes)
      .where(where)
      .orderBy(desc(creditNotes.createdAt), desc(creditNotes.id))
      .limit(limit);
  }

  async aggregateCreditedAmounts(invoiceIds: readonly string[]): Promise<InvoiceCreditedAmount[]> {
    if (_.isEmpty(invoiceIds)) {
      return [];
    }

    return this._db.master
      .select({
        invoiceId: creditNotes.invoiceId,
        creditedAmount: sql<number>`coalesce(sum(${creditNotes.amount}), 0)::int`,
      })
      .from(creditNotes)
      .where(inArray(creditNotes.invoiceId, [...invoiceIds]))
      .groupBy(creditNotes.invoiceId);
  }

  async createCreditNote(
    payload: NewCreditNote,
    executor?: DatabaseTransaction,
  ): Promise<CreditNote | null> {
    const db = executor ?? this._db.master;
    const [creditNote] = await db.insert(creditNotes).values(payload).returning();

    return creditNote ?? null;
  }
}
