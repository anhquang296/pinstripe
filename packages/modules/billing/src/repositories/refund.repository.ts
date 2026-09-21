import type { RefundStatus } from '@contracts/payments.types';
import type { NewRefund, NewRefundTransition, Refund, RefundTransition } from '@database/schemas';
import { refunds, refundTransitions } from '@database/schemas';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import { NotFoundError } from '@vxrerp/platform/errors';
import type { RowCursor } from '@vxrerp/platform/repositories';
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface RefundFilters {
  invoiceId?: string;
  chargeId?: string;
  paymentIntentId?: string;
  pspReference?: string;
  statuses?: readonly RefundStatus[];
  createdAfterAt?: string;
  createdBeforeAt?: string;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export interface InvoiceRefundedAmount {
  invoiceId: string | null;
  refundedAmount: number;
}

export class RefundRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getRefund(id: string): Promise<Refund> {
    const refund = await this.findRefund(id);

    if (refund) {
      return refund;
    }

    throw new NotFoundError(`No such refund: ${id}`);
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
    return this._db.master
      .select()
      .from(refunds)
      .where(RefundRepository.buildWhere(filters))
      .orderBy(desc(refunds.createdAt), desc(refunds.id))
      .limit(limit);
  }

  async aggregateRefundedAmounts(
    invoiceIds: readonly string[],
    statuses: readonly RefundStatus[],
  ): Promise<InvoiceRefundedAmount[]> {
    if (_.isEmpty(invoiceIds)) {
      return [];
    }

    return this._db.master
      .select({
        invoiceId: refunds.invoiceId,
        refundedAmount: sql<number>`coalesce(sum(${refunds.amount}), 0)::int`,
      })
      .from(refunds)
      .where(
        and(
          inArray(refunds.invoiceId, [...invoiceIds]),
          RefundRepository.buildStatusFilter(statuses),
        ),
      )
      .groupBy(refunds.invoiceId);
  }

  async createRefund(payload: NewRefund, executor?: DatabaseTransaction): Promise<Refund | null> {
    const db = executor ?? this._db.master;

    const [refund] = await db.insert(refunds).values(payload).returning();

    return refund ?? null;
  }

  async createRefundTransition(
    payload: NewRefundTransition,
    executor?: DatabaseTransaction,
  ): Promise<RefundTransition | null> {
    const db = executor ?? this._db.master;

    const [transition] = await db.insert(refundTransitions).values(payload).returning();

    return transition ?? null;
  }

  async findRefundTransitions(refundIds: readonly string[]): Promise<RefundTransition[]> {
    if (_.isEmpty(refundIds)) {
      return [];
    }

    return this._db.master
      .select()
      .from(refundTransitions)
      .where(inArray(refundTransitions.refundId, [...refundIds]))
      .orderBy(desc(refundTransitions.occurredAt), desc(refundTransitions.id));
  }

  private static buildStatusFilter(statuses: readonly RefundStatus[] | undefined) {
    if (!statuses) {
      return undefined;
    }

    const statusList = sql.join(
      _.map(statuses, (status) => {
        return sql`${status}`;
      }),
      sql`, `,
    );

    return sql`exists (select 1 from ${refundTransitions} as transition where transition.refund_id = ${refunds.id} and transition.status in (${statusList}))`;
  }

  private static buildWhere(filters: RefundFilters) {
    return and(
      filters.invoiceId ? eq(refunds.invoiceId, filters.invoiceId) : undefined,
      filters.chargeId ? eq(refunds.chargeId, filters.chargeId) : undefined,
      filters.paymentIntentId ? eq(refunds.paymentIntentId, filters.paymentIntentId) : undefined,
      filters.pspReference ? eq(refunds.pspReference, filters.pspReference) : undefined,
      RefundRepository.buildStatusFilter(filters.statuses),
      filters.createdAfterAt ? gte(refunds.createdAt, filters.createdAfterAt) : undefined,
      filters.createdBeforeAt ? lt(refunds.createdAt, filters.createdBeforeAt) : undefined,
      filters.beforeAt
        ? sql`(${refunds.createdAt}, ${refunds.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${refunds.createdAt}, ${refunds.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );
  }
}
