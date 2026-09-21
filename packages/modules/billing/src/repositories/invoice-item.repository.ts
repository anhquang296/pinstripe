import type { InvoiceItem, NewInvoiceItem } from '@database/schemas';
import { invoiceItems } from '@database/schemas';
import type { Currency } from '@utils/currency';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { Database, DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import { NotFoundError } from '@vxrerp/platform/errors';
import type { RowCursor } from '@vxrerp/platform/repositories';
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface InvoiceItemFilters {
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

  async getInvoiceItem(id: string): Promise<InvoiceItem> {
    const invoiceItem = await this.findInvoiceItem(id);

    if (invoiceItem) {
      return invoiceItem;
    }

    throw new NotFoundError(`No such invoice item: ${id}`);
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
        ? sql`(${invoiceItems.createdAt}, ${invoiceItems.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${invoiceItems.createdAt}, ${invoiceItems.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
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
    attachedAt: string,
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
    deletedAt: string,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    const db: Database | DatabaseTransaction = executor ?? this._db.master;

    await db
      .update(invoiceItems)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(invoiceItems.id, id), isNull(invoiceItems.deletedAt)));
  }
}
