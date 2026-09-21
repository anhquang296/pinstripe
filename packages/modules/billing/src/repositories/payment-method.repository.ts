import type { PaymentMethodType } from '@contracts/payment-methods.types';
import type { NewPaymentMethod, PaymentMethod } from '@database/schemas';
import { paymentMethods } from '@database/schemas';
import { DEFAULT_QUERY_LIMIT } from '@vxrerp/platform/constants';
import type { DatabaseClient, DatabaseTransaction } from '@vxrerp/platform/database';
import { NotFoundError } from '@vxrerp/platform/errors';
import type { RowCursor } from '@vxrerp/platform/repositories';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

export interface PaymentMethodFilters {
  customerId?: string;
  type?: PaymentMethodType;
  isAttached?: boolean;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class PaymentMethodRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getPaymentMethod(id: string): Promise<PaymentMethod> {
    const paymentMethod = await this.findPaymentMethod(id);

    if (paymentMethod) {
      return paymentMethod;
    }

    throw new NotFoundError(`No such payment method: ${id}`);
  }

  async findPaymentMethod(id: string): Promise<PaymentMethod | null> {
    const [paymentMethod] = await this._db.master
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.id, id))
      .limit(1);

    return paymentMethod ?? null;
  }

  async findPaymentMethods(
    filters: PaymentMethodFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<PaymentMethod[]> {
    const where = and(
      filters.customerId ? eq(paymentMethods.customerId, filters.customerId) : undefined,
      filters.type ? eq(paymentMethods.type, filters.type) : undefined,
      filters.isAttached ? isNull(paymentMethods.detachedAt) : undefined,
      filters.beforeAt
        ? sql`(${paymentMethods.createdAt}, ${paymentMethods.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${paymentMethods.createdAt}, ${paymentMethods.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(paymentMethods)
      .where(where)
      .orderBy(desc(paymentMethods.createdAt), desc(paymentMethods.id))
      .limit(limit);
  }

  async createPaymentMethod(
    payload: NewPaymentMethod,
    executor?: DatabaseTransaction,
  ): Promise<PaymentMethod | null> {
    const db = executor ?? this._db.master;

    const [paymentMethod] = await db.insert(paymentMethods).values(payload).returning();

    return paymentMethod ?? null;
  }

  async updatePaymentMethod(
    id: string,
    payload: Partial<NewPaymentMethod>,
    executor?: DatabaseTransaction,
  ): Promise<PaymentMethod | null> {
    const db = executor ?? this._db.master;

    const [paymentMethod] = await db
      .update(paymentMethods)
      .set(payload)
      .where(eq(paymentMethods.id, id))
      .returning();

    return paymentMethod ?? null;
  }
}
