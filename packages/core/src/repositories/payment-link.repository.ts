import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type {
  NewPaymentLink,
  NewPaymentLinkLineItem,
  PaymentLink,
  PaymentLinkLineItem,
} from '@database/schemas';
import { paymentLinkLineItems, paymentLinks } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

export interface PaymentLinkFilters {
  isActive?: boolean;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class PaymentLinkRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async getPaymentLink(id: string): Promise<PaymentLink> {
    const paymentLink = await this.findPaymentLink(id);

    if (paymentLink) {
      return paymentLink;
    }

    throw new NotFoundError(`No such payment link: ${id}`);
  }

  async findPaymentLink(id: string): Promise<PaymentLink | null> {
    const [paymentLink] = await this._db.master
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.id, id))
      .limit(1);

    return paymentLink ?? null;
  }

  async findPaymentLinks(
    filters: PaymentLinkFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<PaymentLink[]> {
    const where = and(
      filters.isActive === undefined ? undefined : eq(paymentLinks.isActive, filters.isActive),
      filters.beforeAt
        ? sql`(${paymentLinks.createdAt}, ${paymentLinks.id}) < (${filters.beforeAt.createdAt}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${paymentLinks.createdAt}, ${paymentLinks.id}) > (${filters.afterAt.createdAt}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(paymentLinks)
      .where(where)
      .orderBy(desc(paymentLinks.createdAt), desc(paymentLinks.id))
      .limit(limit);
  }

  async createPaymentLink(
    payload: NewPaymentLink,
    executor?: DatabaseTransaction,
  ): Promise<PaymentLink | null> {
    const db = executor ?? this._db.master;

    const [paymentLink] = await db.insert(paymentLinks).values(payload).returning();

    return paymentLink ?? null;
  }

  async updatePaymentLink(
    id: string,
    payload: Partial<NewPaymentLink>,
    executor?: DatabaseTransaction,
  ): Promise<PaymentLink | null> {
    const db = executor ?? this._db.master;

    const [paymentLink] = await db
      .update(paymentLinks)
      .set(payload)
      .where(eq(paymentLinks.id, id))
      .returning();

    return paymentLink ?? null;
  }

  async createPaymentLinkLineItems(
    payloads: readonly NewPaymentLinkLineItem[],
    executor?: DatabaseTransaction,
  ): Promise<void> {
    if (payloads.length === 0) {
      return;
    }

    const db = executor ?? this._db.master;

    await db.insert(paymentLinkLineItems).values([...payloads]);
  }

  async findPaymentLinkLineItems(
    paymentLinkIds: readonly string[],
  ): Promise<PaymentLinkLineItem[]> {
    if (paymentLinkIds.length === 0) {
      return [];
    }

    return this._db.master
      .select()
      .from(paymentLinkLineItems)
      .where(inArray(paymentLinkLineItems.paymentLinkId, [...paymentLinkIds]))
      .orderBy(asc(paymentLinkLineItems.createdAt), asc(paymentLinkLineItems.id));
  }
}
