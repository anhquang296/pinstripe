import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { CreditNoteStatus } from '@contracts/invoices.types';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type {
  CreditNote,
  CreditNoteLineItem,
  CreditNoteTransition,
  NewCreditNote,
  NewCreditNoteLineItem,
  NewCreditNoteTransition,
} from '@database/schemas';
import { creditNoteLineItems, creditNotes, creditNoteTransitions } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface InvoiceCreditedAmount {
  invoiceId: string;
  creditedAmount: number;
}

export interface CreditNoteFilters {
  livemode?: boolean;
  invoiceId?: string;
  invoiceIds?: readonly string[];
  customerId?: string;
  excludedStatuses?: readonly CreditNoteStatus[];
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
    return this._db.master
      .select()
      .from(creditNotes)
      .where(CreditNoteRepository.buildWhere(filters))
      .orderBy(desc(creditNotes.createdAt), desc(creditNotes.id))
      .limit(limit);
  }

  async aggregateCreditedAmounts(
    invoiceIds: readonly string[],
    excludedStatuses: readonly CreditNoteStatus[],
  ): Promise<InvoiceCreditedAmount[]> {
    if (_.isEmpty(invoiceIds)) {
      return [];
    }

    return this._db.master
      .select({
        invoiceId: creditNotes.invoiceId,
        creditedAmount: sql<number>`coalesce(sum(${creditNotes.amount}), 0)::int`,
      })
      .from(creditNotes)
      .where(
        and(
          inArray(creditNotes.invoiceId, [...invoiceIds]),
          CreditNoteRepository.buildStatusFilter(excludedStatuses),
        ),
      )
      .groupBy(creditNotes.invoiceId);
  }

  async createCreditNote(
    payload: NewCreditNote,
    lines: readonly NewCreditNoteLineItem[],
    executor?: DatabaseTransaction,
  ): Promise<CreditNote | null> {
    const db = executor ?? this._db.master;
    const [creditNote] = await db.insert(creditNotes).values(payload).returning();

    if (creditNote && !_.isEmpty(lines)) {
      await db.insert(creditNoteLineItems).values([...lines]);
    }

    return creditNote ?? null;
  }

  async findCreditNoteLineItems(creditNoteIds: readonly string[]): Promise<CreditNoteLineItem[]> {
    if (_.isEmpty(creditNoteIds)) {
      return [];
    }

    return this._db.master
      .select()
      .from(creditNoteLineItems)
      .where(inArray(creditNoteLineItems.creditNoteId, [...creditNoteIds]))
      .orderBy(creditNoteLineItems.id);
  }

  async createCreditNoteTransition(
    payload: NewCreditNoteTransition,
    executor?: DatabaseTransaction,
  ): Promise<CreditNoteTransition | null> {
    const db = executor ?? this._db.master;
    const [transition] = await db.insert(creditNoteTransitions).values(payload).returning();

    return transition ?? null;
  }

  async findCreditNoteTransitions(
    creditNoteIds: readonly string[],
  ): Promise<CreditNoteTransition[]> {
    if (_.isEmpty(creditNoteIds)) {
      return [];
    }

    return this._db.master
      .select()
      .from(creditNoteTransitions)
      .where(inArray(creditNoteTransitions.creditNoteId, [...creditNoteIds]))
      .orderBy(desc(creditNoteTransitions.occurredAt), desc(creditNoteTransitions.id));
  }

  private static buildStatusFilter(excludedStatuses: readonly CreditNoteStatus[] | undefined) {
    if (!excludedStatuses) {
      return undefined;
    }

    const statusList = sql.join(
      _.map(excludedStatuses, (status) => {
        return sql`${status}`;
      }),
      sql`, `,
    );

    return sql`not exists (select 1 from ${creditNoteTransitions} as transition where transition.credit_note_id = ${creditNotes.id} and transition.status in (${statusList}))`;
  }

  private static buildWhere(filters: CreditNoteFilters) {
    return and(
      filters.livemode === undefined ? undefined : eq(creditNotes.livemode, filters.livemode),
      filters.invoiceId ? eq(creditNotes.invoiceId, filters.invoiceId) : undefined,
      filters.invoiceIds ? inArray(creditNotes.invoiceId, [...filters.invoiceIds]) : undefined,
      filters.customerId ? eq(creditNotes.customerId, filters.customerId) : undefined,
      CreditNoteRepository.buildStatusFilter(filters.excludedStatuses),
      filters.beforeAt
        ? sql`(${creditNotes.createdAt}, ${creditNotes.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${creditNotes.createdAt}, ${creditNotes.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );
  }
}
