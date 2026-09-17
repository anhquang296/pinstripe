import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { BillingReason, InvoiceStatus } from '@contracts/invoices.types';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type {
  Invoice,
  InvoiceLineItem,
  InvoicePayment,
  NewInvoice,
  NewInvoiceLineItem,
  NewInvoicePayment,
} from '@database/schemas';
import { invoiceLineItems, invoicePayments, invoices } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, asc, desc, eq, inArray, lt, lte, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface InvoiceFilters {
  livemode?: boolean;
  customerId?: string;
  subscriptionId?: string;
  status?: InvoiceStatus;
  statuses?: readonly InvoiceStatus[];
  billingReason?: BillingReason;
  periodStart?: Date;
  periodEndBeforeAt?: Date;
  nextAttemptBeforeAt?: Date;
  autoAdvance?: boolean;
  createdBeforeAt?: Date;
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

  async lockInvoice(id: string, executor: DatabaseTransaction): Promise<Invoice | null> {
    const [invoice] = await executor
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1)
      .for('update');

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
    if (_.isEmpty(invoiceIds)) {
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
    if (_.isEmpty(payload)) {
      return;
    }

    const db = executor ?? this._db.master;

    await db.insert(invoiceLineItems).values([...payload]);
  }

  async findInvoicePayments(invoiceIds: readonly string[]): Promise<InvoicePayment[]> {
    if (_.isEmpty(invoiceIds)) {
      return [];
    }

    return this._db.master
      .select()
      .from(invoicePayments)
      .where(inArray(invoicePayments.invoiceId, [...invoiceIds]))
      .orderBy(asc(invoicePayments.paidAt), asc(invoicePayments.id));
  }

  async createInvoicePayment(
    payload: NewInvoicePayment,
    executor?: DatabaseTransaction,
  ): Promise<InvoicePayment | null> {
    const db = executor ?? this._db.master;
    const [invoicePayment] = await db.insert(invoicePayments).values(payload).returning();

    return invoicePayment ?? null;
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

  private static buildWhere(filters: InvoiceFilters) {
    return and(
      filters.livemode === undefined ? undefined : eq(invoices.livemode, filters.livemode),
      filters.customerId ? eq(invoices.customerId, filters.customerId) : undefined,
      filters.subscriptionId ? eq(invoices.subscriptionId, filters.subscriptionId) : undefined,
      filters.status ? eq(invoices.status, filters.status) : undefined,
      filters.statuses ? inArray(invoices.status, [...filters.statuses]) : undefined,
      filters.billingReason ? eq(invoices.billingReason, filters.billingReason) : undefined,
      filters.periodStart ? eq(invoices.periodStart, filters.periodStart) : undefined,
      filters.periodEndBeforeAt ? lte(invoices.periodEnd, filters.periodEndBeforeAt) : undefined,
      filters.nextAttemptBeforeAt
        ? lte(invoices.nextAttemptAt, filters.nextAttemptBeforeAt)
        : undefined,
      filters.autoAdvance === undefined ? undefined : eq(invoices.autoAdvance, filters.autoAdvance),
      filters.createdBeforeAt ? lt(invoices.createdAt, filters.createdBeforeAt) : undefined,
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
