import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { NewRefund, Refund } from '@database/schemas';
import { refunds } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface RefundFilters {
  invoiceId?: string;
  paymentIntentId?: string;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export interface InvoiceRefundedAmount {
  invoiceId: string;
  refundedAmount: number;
}

export class RefundRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findRefund(id: string): Promise<Refund | null> {
    const [refund] = await this._db.master
      .select()
      .from(refunds)
      .where(eq(refunds.id, id))
      .limit(1);

    return refund ?? null;
  }

  async findRefunds(filters: RefundFilters = {}, limit = DEFAULT_QUERY_LIMIT): Promise<Refund[]> {
    const where = and(
      filters.invoiceId ? eq(refunds.invoiceId, filters.invoiceId) : undefined,
      filters.paymentIntentId ? eq(refunds.paymentIntentId, filters.paymentIntentId) : undefined,
      filters.beforeAt
        ? sql`(${refunds.createdAt}, ${refunds.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${refunds.createdAt}, ${refunds.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(refunds)
      .where(where)
      .orderBy(desc(refunds.createdAt), desc(refunds.id))
      .limit(limit);
  }

  async aggregateRefundedAmounts(invoiceIds: readonly string[]): Promise<InvoiceRefundedAmount[]> {
    if (_.isEmpty(invoiceIds)) {
      return [];
    }

    return this._db.master
      .select({
        invoiceId: refunds.invoiceId,
        refundedAmount: sql<number>`coalesce(sum(${refunds.amount}), 0)::int`,
      })
      .from(refunds)
      .where(inArray(refunds.invoiceId, [...invoiceIds]))
      .groupBy(refunds.invoiceId);
  }

  async createRefund(payload: NewRefund, executor?: DatabaseTransaction): Promise<Refund | null> {
    const db = executor ?? this._db.master;
    const [refund] = await db.insert(refunds).values(payload).returning();

    return refund ?? null;
  }
}
