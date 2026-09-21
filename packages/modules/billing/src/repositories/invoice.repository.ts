import type { BillingReason, InvoiceReminderKind, InvoiceStatus } from '@contracts/invoices.types';
import type { CollectionMethod } from '@contracts/subscriptions.types';
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceLineItemTaxAmount,
  InvoicePayment,
  InvoiceReminder,
  NewInvoice,
  NewInvoiceLineItem,
  NewInvoiceLineItemTaxAmount,
  NewInvoicePayment,
  NewInvoiceReminder,
} from '@database/schemas';
import {
  invoiceLineItems,
  invoiceLineItemTaxAmounts,
  invoicePayments,
  invoiceReminders,
  invoices,
} from '@database/schemas';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import { NotFoundError } from '@vxrerp/platform/errors';
import type { RowCursor } from '@vxrerp/platform/repositories';
import { and, asc, desc, eq, gt, inArray, lt, lte, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface InvoiceFilters {
  customerId?: string;
  subscriptionId?: string;
  status?: InvoiceStatus;
  statuses?: readonly InvoiceStatus[];
  collectionMethod?: CollectionMethod;
  billingReason?: BillingReason;
  periodStart?: string;
  periodEndBeforeAt?: string;
  nextAttemptBeforeAt?: string;
  dueBeforeAt?: string;
  dueAfterAt?: string;
  autoAdvance?: boolean;
  createdBeforeAt?: string;
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

  async getInvoice(id: string): Promise<Invoice> {
    const invoice = await this.findInvoice(id);

    if (invoice) {
      return invoice;
    }

    throw new NotFoundError(`No such invoice: ${id}`);
  }

  async findInvoice(id: string): Promise<Invoice | null> {
    const [invoice] = await this._db.master
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);

    return invoice ?? null;
  }

  async getLockedInvoice(id: string, executor: DatabaseTransaction): Promise<Invoice> {
    const [invoice] = await executor
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1)
      .for('update');

    if (invoice) {
      return invoice;
    }

    throw new NotFoundError(`No such invoice: ${id}`);
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

  async findInvoiceLineItemTaxAmounts(
    invoiceIds: readonly string[],
  ): Promise<InvoiceLineItemTaxAmount[]> {
    if (_.isEmpty(invoiceIds)) {
      return [];
    }

    return this._db.master
      .select()
      .from(invoiceLineItemTaxAmounts)
      .where(inArray(invoiceLineItemTaxAmounts.invoiceId, [...invoiceIds]))
      .orderBy(asc(invoiceLineItemTaxAmounts.createdAt), asc(invoiceLineItemTaxAmounts.id));
  }

  async createInvoiceLineItemTaxAmounts(
    payload: readonly NewInvoiceLineItemTaxAmount[],
    executor?: DatabaseTransaction,
  ): Promise<void> {
    if (_.isEmpty(payload)) {
      return;
    }

    const db = executor ?? this._db.master;

    await db.insert(invoiceLineItemTaxAmounts).values([...payload]);
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

  async findInvoiceReminders(
    invoiceIds: readonly string[],
    kind?: InvoiceReminderKind,
  ): Promise<InvoiceReminder[]> {
    if (_.isEmpty(invoiceIds)) {
      return [];
    }

    return this._db.master
      .select()
      .from(invoiceReminders)
      .where(
        and(
          inArray(invoiceReminders.invoiceId, [...invoiceIds]),
          kind ? eq(invoiceReminders.kind, kind) : undefined,
        ),
      );
  }

  async createInvoiceReminder(payload: NewInvoiceReminder): Promise<InvoiceReminder | null> {
    const [invoiceReminder] = await this._db.master
      .insert(invoiceReminders)
      .values(payload)
      .onConflictDoNothing({ target: [invoiceReminders.invoiceId, invoiceReminders.kind] })
      .returning();

    return invoiceReminder ?? null;
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
      filters.customerId ? eq(invoices.customerId, filters.customerId) : undefined,
      filters.subscriptionId ? eq(invoices.subscriptionId, filters.subscriptionId) : undefined,
      filters.status ? eq(invoices.status, filters.status) : undefined,
      filters.statuses ? inArray(invoices.status, [...filters.statuses]) : undefined,
      filters.collectionMethod
        ? eq(invoices.collectionMethod, filters.collectionMethod)
        : undefined,
      filters.billingReason ? eq(invoices.billingReason, filters.billingReason) : undefined,
      filters.periodStart ? eq(invoices.periodStart, filters.periodStart) : undefined,
      filters.periodEndBeforeAt ? lte(invoices.periodEnd, filters.periodEndBeforeAt) : undefined,
      filters.nextAttemptBeforeAt
        ? lte(invoices.nextAttemptAt, filters.nextAttemptBeforeAt)
        : undefined,
      filters.dueBeforeAt ? lt(invoices.dueAt, filters.dueBeforeAt) : undefined,
      filters.dueAfterAt ? gt(invoices.dueAt, filters.dueAfterAt) : undefined,
      filters.autoAdvance === undefined ? undefined : eq(invoices.autoAdvance, filters.autoAdvance),
      filters.createdBeforeAt ? lt(invoices.createdAt, filters.createdBeforeAt) : undefined,
      filters.shardCount && filters.shardIndex !== undefined
        ? sql`abs(hashtext(${invoices.customerId})) % ${filters.shardCount} = ${filters.shardIndex}`
        : undefined,
      filters.beforeAt
        ? sql`(${invoices.createdAt}, ${invoices.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${invoices.createdAt}, ${invoices.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );
  }
}
