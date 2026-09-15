import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { PaymentIntentStatus } from '@contracts/payments.types';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type {
  NewPaymentAttempt,
  NewPaymentIntent,
  PaymentAttempt,
  PaymentIntent,
} from '@database/schemas';
import { paymentAttempts, paymentIntents } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

export interface PaymentIntentFilters {
  invoiceId?: string;
  customerId?: string;
  status?: PaymentIntentStatus;
  statuses?: readonly PaymentIntentStatus[];
  beforeAt?: RowCursor;
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

  async findPaymentIntents(
    filters: PaymentIntentFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<PaymentIntent[]> {
    const where = and(
      filters.invoiceId ? eq(paymentIntents.invoiceId, filters.invoiceId) : undefined,
      filters.customerId ? eq(paymentIntents.customerId, filters.customerId) : undefined,
      filters.status ? eq(paymentIntents.status, filters.status) : undefined,
      filters.statuses ? inArray(paymentIntents.status, [...filters.statuses]) : undefined,
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

  async findPaymentAttempts(paymentIntentIds: readonly string[]): Promise<PaymentAttempt[]> {
    if (paymentIntentIds.length === 0) {
      return [];
    }

    return this._db.master
      .select()
      .from(paymentAttempts)
      .where(inArray(paymentAttempts.paymentIntentId, [...paymentIntentIds]))
      .orderBy(asc(paymentAttempts.createdAt), asc(paymentAttempts.id));
  }

  async createPaymentIntent(
    payload: NewPaymentIntent,
    executor?: DatabaseTransaction,
  ): Promise<PaymentIntent | null> {
    const db = executor ?? this._db.master;
    const [paymentIntent] = await db.insert(paymentIntents).values(payload).returning();

    return paymentIntent ?? null;
  }

  async createPaymentAttempt(
    payload: NewPaymentAttempt,
    executor?: DatabaseTransaction,
  ): Promise<void> {
    const db = executor ?? this._db.master;

    await db.insert(paymentAttempts).values(payload);
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
}
