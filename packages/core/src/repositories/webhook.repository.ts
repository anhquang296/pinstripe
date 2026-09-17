import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { WebhookDeliveryStatus, WebhookEndpointStatus } from '@contracts/webhooks.types';
import type { DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type {
  NewWebhookDelivery,
  NewWebhookEndpoint,
  WebhookDelivery,
  WebhookEndpoint,
} from '@database/schemas';
import { webhookDeliveries, webhookEndpoints } from '@database/schemas';
import type { RowCursor } from '@repositories/cursor';
import { and, desc, eq, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface WebhookEndpointFilters {
  status?: WebhookEndpointStatus;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export interface WebhookDeliveryFilters {
  endpointId?: string;
  status?: WebhookDeliveryStatus;
  beforeAt?: RowCursor;
  afterAt?: RowCursor;
}

export class WebhookRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findWebhookEndpoint(id: string): Promise<WebhookEndpoint | null> {
    const [endpoint] = await this._db.master
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, id))
      .limit(1);

    return endpoint ?? null;
  }

  async findWebhookEndpoints(
    filters: WebhookEndpointFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<WebhookEndpoint[]> {
    const where = and(
      filters.status ? eq(webhookEndpoints.status, filters.status) : undefined,
      filters.beforeAt
        ? sql`(${webhookEndpoints.createdAt}, ${webhookEndpoints.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${webhookEndpoints.createdAt}, ${webhookEndpoints.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(webhookEndpoints)
      .where(where)
      .orderBy(desc(webhookEndpoints.createdAt), desc(webhookEndpoints.id))
      .limit(limit);
  }

  async createWebhookEndpoint(payload: NewWebhookEndpoint): Promise<WebhookEndpoint | null> {
    const [endpoint] = await this._db.master.insert(webhookEndpoints).values(payload).returning();

    return endpoint ?? null;
  }

  async updateWebhookEndpoint(
    id: string,
    payload: Partial<NewWebhookEndpoint>,
  ): Promise<WebhookEndpoint | null> {
    const [endpoint] = await this._db.master
      .update(webhookEndpoints)
      .set(payload)
      .where(eq(webhookEndpoints.id, id))
      .returning();

    return endpoint ?? null;
  }

  async findWebhookDelivery(id: string): Promise<WebhookDelivery | null> {
    const [delivery] = await this._db.master
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, id))
      .limit(1);

    return delivery ?? null;
  }

  async findWebhookDeliveries(
    filters: WebhookDeliveryFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<WebhookDelivery[]> {
    const where = and(
      filters.endpointId ? eq(webhookDeliveries.endpointId, filters.endpointId) : undefined,
      filters.status ? eq(webhookDeliveries.status, filters.status) : undefined,
      filters.beforeAt
        ? sql`(${webhookDeliveries.createdAt}, ${webhookDeliveries.id}) < (${filters.beforeAt.createdAt.toISOString()}::timestamptz, ${filters.beforeAt.id})`
        : undefined,
      filters.afterAt
        ? sql`(${webhookDeliveries.createdAt}, ${webhookDeliveries.id}) > (${filters.afterAt.createdAt.toISOString()}::timestamptz, ${filters.afterAt.id})`
        : undefined,
    );

    return this._db.master
      .select()
      .from(webhookDeliveries)
      .where(where)
      .orderBy(desc(webhookDeliveries.createdAt), desc(webhookDeliveries.id))
      .limit(limit);
  }

  async createWebhookDeliveries(
    payload: readonly NewWebhookDelivery[],
    executor?: DatabaseTransaction,
  ): Promise<WebhookDelivery[]> {
    if (_.isEmpty(payload)) {
      return [];
    }

    const db = executor ?? this._db.master;

    return db
      .insert(webhookDeliveries)
      .values([...payload])
      .returning();
  }

  async updateWebhookDelivery(
    id: string,
    payload: Partial<NewWebhookDelivery>,
  ): Promise<WebhookDelivery | null> {
    const [delivery] = await this._db.master
      .update(webhookDeliveries)
      .set(payload)
      .where(eq(webhookDeliveries.id, id))
      .returning();

    return delivery ?? null;
  }
}
