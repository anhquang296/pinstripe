import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { InvoiceItem, NewInvoiceItem } from '@database/schemas';
import { invoiceItems } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import type { Currency } from '@utils/currency';
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface InvoiceItemFilters {
  livemode?: boolean;
  customerId?: string;
  currency?: Currency;
  invoiceId?: string;
  invoiceIdIsNull?: boolean;
  pendingForInvoiceId?: string;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class InvoiceItemRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findInvoiceItem(id: string): Promise<InvoiceItem | null> {
    const [invoiceItem] = await this._db.master
      .select()
      .from(invoiceItems)
      .where(and(eq(invoiceItems.id, id), isNull(invoiceItems.deletedAt)))
      .limit(1);

    return invoiceItem ?? null;
  }

  async findInvoiceItems(
    filters: InvoiceItemFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<InvoiceItem[]> {
    const where = and(
      isNull(invoiceItems.deletedAt),
      filters.livemode === undefined ? undefined : eq(invoiceItems.livemode, filters.livemode),
      filters.customerId ? eq(invoiceItems.customerId, filters.customerId) : undefined,
      filters.currency ? eq(invoiceItems.currency, filters.currency) : undefined,
      filters.invoiceId ? eq(invoiceItems.invoiceId, filters.invoiceId) : undefined,
      filters.invoiceIdIsNull === undefined
        ? undefined
        : filters.invoiceIdIsNull
          ? isNull(invoiceItems.invoiceId)
          : sql`${invoiceItems.invoiceId} is not null`,
      filters.pendingForInvoiceId
        ? or(
            isNull(invoiceItems.invoiceId),
            eq(invoiceItems.invoiceId, filters.pendingForInvoiceId),
          )
        : undefined,
      filters.beforeAt
        ? sql`(${invoiceItems.createdAt}, ${invoiceItems.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${invoiceItems.createdAt}, ${invoiceItems.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(invoiceItems)
      .where(where)
      .orderBy(asc(invoiceItems.createdAt), asc(invoiceItems.id))
      .limit(limit);
  }

  async createInvoiceItem(
    payload: NewInvoiceItem,
    executor?: DatabaseTransaction,
  ): Promise<InvoiceItem | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [invoiceItem] = await db.insert(invoiceItems).values(payload).returning();

    return invoiceItem ?? null;
  }

  async updateInvoiceItem(
    id: string,
    payload: Partial<NewInvoiceItem>,
    executor?: DatabaseTransaction,
  ): Promise<InvoiceItem | null> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const [invoiceItem] = await db
      .update(invoiceItems)
      .set(payload)
      .where(and(eq(invoiceItems.id, id), isNull(invoiceItems.deletedAt)))
      .returning();

    return invoiceItem ?? null;
  }

  async attachInvoiceItems(
    ids: readonly string[],
    invoiceId: string,
    attachedAt: Date,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    if (_.isEmpty(ids)) {
      return;
    }

    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(invoiceItems)
      .set({ invoiceId, updatedAt: attachedAt })
      .where(inArray(invoiceItems.id, [...ids]));
  }

  async archiveInvoiceItem(
    id: string,
    deletedAt: Date,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(invoiceItems)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(invoiceItems.id, id), isNull(invoiceItems.deletedAt)));
  }
}
