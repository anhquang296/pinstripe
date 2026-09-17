import { DEFAULT_QUERY_LIMIT } from '@constants/pagination';
import type { MeterAggregation } from '@contracts/meters.types';
import { MeterAggregationEnum } from '@contracts/meters.types';
import type { Database, DatabaseClient, DatabaseTransaction } from '@database/database.client';
import type { MeterEvent, NewMeterEvent } from '@database/schemas';
import { meterEvents } from '@database/schemas';
import type { SQL } from 'drizzle-orm';
import { and, desc, eq, gt, gte, lt, lte, sql } from 'drizzle-orm';
import _ from 'lodash';

export interface MeterEventFilters {
  livemode?: boolean;
  meterId?: string;
  customerId?: string;
  timestampFrom?: Date;
  timestampTo?: Date;
  receivedBefore?: Date;
  receivedAfter?: Date;
}

export interface MeterEventTotals {
  value: number;
  eventCount: number;
}

const VALUE_EXPRESSIONS: Record<MeterAggregation, SQL<number>> = {
  [MeterAggregationEnum.SUM]: sql<number>`coalesce(sum(${meterEvents.value}), 0)`,
  [MeterAggregationEnum.COUNT]: sql<number>`count(*)`,
  [MeterAggregationEnum.MAX]: sql<number>`coalesce(max(${meterEvents.value}), 0)`,
  [MeterAggregationEnum.UNIQUE_COUNT]: sql<number>`count(distinct ${meterEvents.value})`,
};

export class MeterEventRepository {
  private _db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this._db = db;
  }

  async findMeterEvents(
    filters: MeterEventFilters = {},
    limit = DEFAULT_QUERY_LIMIT,
  ): Promise<MeterEvent[]> {
    return this._db.master
      .select()
      .from(meterEvents)
      .where(MeterEventRepository.buildWhere(filters))
      .orderBy(desc(meterEvents.timestamp), desc(meterEvents.id))
      .limit(limit);
  }

  async createMeterEvents(
    payloads: readonly NewMeterEvent[],
    executor?: DatabaseTransaction,
  ): Promise<string[]> {
    if (_.isEmpty(payloads)) {
      return [];
    }

    const db: Database | DatabaseTransaction = executor ?? this._db.master;
    const insertedRows = await db
      .insert(meterEvents)
      .values([...payloads])
      .onConflictDoNothing({ target: [meterEvents.meterId, meterEvents.identifier] })
      .returning({ id: meterEvents.id });

    return _.map(insertedRows, 'id');
  }

  async aggregateMeterEventTotals(
    aggregation: MeterAggregation,
    filters: MeterEventFilters,
  ): Promise<MeterEventTotals> {
    const [totals] = await this._db.master
      .select({
        value: VALUE_EXPRESSIONS[aggregation],
        eventCount: sql<number>`count(*)`,
      })
      .from(meterEvents)
      .where(MeterEventRepository.buildWhere(filters));

    return {
      value: Number(_.get(totals, 'value', 0)),
      eventCount: Number(_.get(totals, 'eventCount', 0)),
    };
  }

  private static buildWhere(filters: MeterEventFilters) {
    return and(
      filters.livemode === undefined ? undefined : eq(meterEvents.livemode, filters.livemode),
      filters.meterId ? eq(meterEvents.meterId, filters.meterId) : undefined,
      filters.customerId ? eq(meterEvents.customerId, filters.customerId) : undefined,
      filters.timestampFrom ? gte(meterEvents.timestamp, filters.timestampFrom) : undefined,
      filters.timestampTo ? lt(meterEvents.timestamp, filters.timestampTo) : undefined,
      filters.receivedBefore ? lte(meterEvents.receivedAt, filters.receivedBefore) : undefined,
      filters.receivedAfter ? gt(meterEvents.receivedAt, filters.receivedAfter) : undefined,
    );
  }
}
