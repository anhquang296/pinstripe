import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { InvoiceStatus, NumberSequence } from '@contracts/invoices.types';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { Invoice, InvoiceLineItem, NewInvoice, NewInvoiceLineItem } from '@database/schemas';
import { invoiceLineItems, invoices, numberSequences } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm';

export interface InvoiceFilters {
  customerId?: string;
  subscriptionId?: string;
  status?: InvoiceStatus;
  statuses?: readonly InvoiceStatus[];
  periodEndBeforeAt?: Date;
  nextAttemptBeforeAt?: Date;
  shardCount?: number;
  shardIndex?: number;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class InvoiceRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findInvoice(id: string): Promise<Invoice | null> {
    const [invoice] = await this._db.master
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    return invoice ?? null;
  }

  async findInvoices(
    filters: InvoiceFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<Invoice[]> {
    return this._db.master
      .select()
      .from(invoices)
      .where(InvoiceRepository.buildWhere(filters))
      .orderBy(desc(invoices.createdAt), desc(invoices.id))
      .limit(limit);
  }

  async findInvoiceLineItems(invoiceIds: readonly string[]): Promise<InvoiceLineItem[]> {
    if (invoiceIds.length === 0) {
      return [];
    }

    return this._db.master
      .select()
      .from(invoiceLineItems)
      .where(inArray(invoiceLineItems.invoiceId, [...invoiceIds]))
      .orderBy(asc(invoiceLineItems.createdAt), asc(invoiceLineItems.id));
  }

  async createInvoice(
    payload: NewInvoice,
    executor?: DatabaseTransaction,
  ): Promise<Invoice | null> {
    const db = executor ?? this._db.master;
    const [invoice] = await db.insert(invoices).values(payload).returning();

    return invoice ?? null;
  }

  async createInvoiceLineItems(
    payload: readonly NewInvoiceLineItem[],
    executor?: DatabaseTransaction,
  ): Promise<void> {
    if (payload.length === 0) {
      return;
    }

    const db = executor ?? this._db.master;

    await db.insert(invoiceLineItems).values([...payload]);
  }

  async updateInvoice(
    id: string,
    payload: Partial<NewInvoice>,
    executor?: DatabaseTransaction,
  ): Promise<Invoice | null> {
    const db = executor ?? this._db.master;
    const [invoice] = await db.update(invoices).set(payload).where(eq(invoices.id, id)).returning();

    return invoice ?? null;
  }

  async claimNextNumber(
    name: NumberSequence,
    executor: DatabaseTransaction,
  ): Promise<number | null> {
    const [claimed] = await executor
      .update(numberSequences)
      .set({ nextValue: sql`${numberSequences.nextValue} + 1` })
      .where(eq(numberSequences.name, name))
      .returning({ nextValue: numberSequences.nextValue });

    return claimed ? claimed.nextValue - 1 : null;
  }

  private static buildWhere(filters: InvoiceFilters) {
    return and(
      filters.customerId ? eq(invoices.customerId, filters.customerId) : undefined,
      filters.subscriptionId ? eq(invoices.subscriptionId, filters.subscriptionId) : undefined,
      filters.status ? eq(invoices.status, filters.status) : undefined,
      filters.statuses ? inArray(invoices.status, [...filters.statuses]) : undefined,
      filters.periodEndBeforeAt ? lte(invoices.periodEnd, filters.periodEndBeforeAt) : undefined,
      filters.nextAttemptBeforeAt
        ? lte(invoices.nextAttemptAt, filters.nextAttemptBeforeAt)
        : undefined,
      filters.shardCount && filters.shardIndex !== undefined
        ? sql`abs(hashtext(${invoices.customerId})) % ${filters.shardCount} = ${filters.shardIndex}`
        : undefined,
      filters.beforeAt
        ? sql`(${invoices.createdAt}, ${invoices.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${invoices.createdAt}, ${invoices.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );
  }
}
