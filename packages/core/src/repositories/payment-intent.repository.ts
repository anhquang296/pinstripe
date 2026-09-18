import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { ChargeStatus, PaymentIntentStatus } from '@contracts/payments.types';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { Charge, NewCharge, NewPaymentIntent, PaymentIntent } from '@database/schemas';
import { charges, paymentIntents } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface PaymentIntentFilters {
  livemode?: boolean;
  ids?: readonly string[];
  invoiceId?: string;
  customerId?: string;
  status?: PaymentIntentStatus;
  statuses?: readonly PaymentIntentStatus[];
  pspReference?: string;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export interface ChargeFilters {
  livemode?: boolean;
  paymentIntentIds?: readonly string[];
  pspReference?: string;
  status?: ChargeStatus;
  createdAfterAt?: Date;
  createdBeforeAt?: Date;
  afterAt?: RowCursor;
}

export class PaymentIntentRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findPaymentIntent(id: string): Promise<PaymentIntent | null> {
    const [paymentIntent] = await this._db.master
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, id))
      .limit(1);

    return paymentIntent ?? null;
  }

  async findLockedPaymentIntent(
    id: string,
    executor: DatabaseTransaction,
  ): Promise<PaymentIntent | null> {
    const [paymentIntent] = await executor
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, id))
      .limit(1)
      .for('update');

    return paymentIntent ?? null;
  }

  async findPaymentIntents(
    filters: PaymentIntentFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<PaymentIntent[]> {
    const where = and(
      filters.livemode === undefined ? undefined : eq(paymentIntents.livemode, filters.livemode),
      filters.ids ? inArray(paymentIntents.id, [...filters.ids]) : undefined,
      filters.invoiceId ? eq(paymentIntents.invoiceId, filters.invoiceId) : undefined,
      filters.customerId ? eq(paymentIntents.customerId, filters.customerId) : undefined,
      filters.status ? eq(paymentIntents.status, filters.status) : undefined,
      filters.statuses ? inArray(paymentIntents.status, [...filters.statuses]) : undefined,
      filters.pspReference ? eq(paymentIntents.pspReference, filters.pspReference) : undefined,
      filters.beforeAt
        ? sql`(${paymentIntents.createdAt}, ${paymentIntents.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${paymentIntents.createdAt}, ${paymentIntents.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(paymentIntents)
      .where(where)
      .orderBy(desc(paymentIntents.createdAt), desc(paymentIntents.id))
      .limit(limit);
  }

  async findCharge(id: string): Promise<Charge | null> {
    const [charge] = await this._db.master
      .select()
      .from(charges)
      .where(eq(charges.id, id))
      .limit(1);

    return charge ?? null;
  }

  async findCharges(filters: ChargeFilters = {}, limit = DEFAULT_QUERY_LIMIT): Promise<Charge[]> {
    if (filters.paymentIntentIds && _.isEmpty(filters.paymentIntentIds)) {
      return [];
    }

    const where = and(
      filters.livemode === undefined ? undefined : eq(charges.livemode, filters.livemode),
      filters.paymentIntentIds
        ? inArray(charges.paymentIntentId, [...filters.paymentIntentIds])
        : undefined,
      filters.pspReference ? eq(charges.pspReference, filters.pspReference) : undefined,
      filters.status ? eq(charges.status, filters.status) : undefined,
      filters.createdAfterAt ? gte(charges.createdAt, filters.createdAfterAt) : undefined,
      filters.createdBeforeAt ? lt(charges.createdAt, filters.createdBeforeAt) : undefined,
      filters.afterAt
        ? sql`(${charges.createdAt}, ${charges.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(charges)
      .where(where)
      .orderBy(asc(charges.createdAt), asc(charges.id))
      .limit(limit);
  }

  async createPaymentIntent(
    payload: NewPaymentIntent,
    executor?: DatabaseTransaction,
  ): Promise<PaymentIntent | null> {
    const db = executor ?? this._db.master;
    const [paymentIntent] = await db.insert(paymentIntents).values(payload).returning();

    return paymentIntent ?? null;
  }

  async createCharge(payload: NewCharge, executor?: DatabaseTransaction): Promise<Charge | null> {
    const db = executor ?? this._db.master;
    const [charge] = await db.insert(charges).values(payload).returning();

    return charge ?? null;
  }

  async updatePaymentIntent(
    id: string,
    payload: Partial<NewPaymentIntent>,
    executor?: DatabaseTransaction,
  ): Promise<PaymentIntent | null> {
    const db = executor ?? this._db.master;
    const [paymentIntent] = await db
      .update(paymentIntents)
      .set(payload)
      .where(eq(paymentIntents.id, id))
      .returning();

    return paymentIntent ?? null;
  }

  async updateCharge(
    id: string,
    payload: Partial<NewCharge>,
    executor?: DatabaseTransaction,
  ): Promise<Charge | null> {
    const db = executor ?? this._db.master;
    const [charge] = await db.update(charges).set(payload).where(eq(charges.id, id)).returning();

    return charge ?? null;
  }
}
