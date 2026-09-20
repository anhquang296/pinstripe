import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type {
  CreateMeterPayload,
  FindMetersQuery,
  MeterResponse,
  UpdateMeterPayload,
} from '@contracts/meters.types';
import { MeterStatusEnum } from '@contracts/meters.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { Meter } from '@database/schemas';
import { ConflictError, NotFoundError } from '@errors/app.error';
import { isUniqueViolation } from '@errors/database.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class MeterService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createMeter(payload: CreateMeterPayload): Promise<MeterResponse> {
    const now = this.fastify.clock.now().toISOString();

    return this.writeMeter(payload, now);
  }

  async getMeter(id: string): Promise<MeterResponse> {
    return this.fastify.meterRepository.getMeter(id);
  }

  async resolveMeter(eventName: string): Promise<Meter> {
    const [meter] = await this.fastify.meterRepository.findMeters(
      { eventName, status: MeterStatusEnum.ACTIVE },
      1,
    );

    if (meter) {
      return meter;
    }

    throw new NotFoundError(`No active meter listens for event ${eventName}`);
  }

  async updateMeter(id: string, payload: UpdateMeterPayload): Promise<MeterResponse> {
    await this.getMeter(id);

    const updatedMeter = await this.fastify.meterRepository.updateMeter(id, {
      ...payload,
      updatedAt: this.fastify.clock.now().toISOString(),
    });

    if (updatedMeter) {
      return updatedMeter;
    }

    throw new NotFoundError(`No such meter: ${id}`);
  }

  async findMeters(query: FindMetersQuery): Promise<ListResponse<MeterResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const meterRows = await this.fastify.meterRepository.findMeters(
      {
        status: query.status,
        beforeAt: await this.resolveCursor(query.after),
        afterAt: await this.resolveCursor(query.before),
      },
      limit + 1,
    );
    const hasMore = meterRows.length > limit;

    return {
      url: '/v1/billing/meters',
      hasMore,
      data: _.take(meterRows, limit),
    };
  }

  private async writeMeter(payload: CreateMeterPayload, now: string): Promise<Meter> {
    const DEFAULT_VALUE_KEY = 'value';
    const id = generateGid(ObjectPrefixEnum.METER);
    const { valueKey = DEFAULT_VALUE_KEY, metadata = {} } = payload;

    try {
      return await this.fastify.database.master.transaction(async (tx) => {
        const meter = await this.fastify.meterRepository.createMeter(
          {
            id,
            displayName: payload.displayName,
            eventName: payload.eventName,
            aggregation: payload.aggregation,
            valueKey,
            status: MeterStatusEnum.ACTIVE,
            metadata,
            createdAt: now,
            updatedAt: now,
          },
          tx,
        );

        if (meter) {
          await this.fastify.outboxService.recordEvents(
            [
              {
                aggregateType: AggregateTypeEnum.METER,
                aggregateId: meter.id,
                eventType: DomainEventTypeEnum.METER_CREATED,
                payload: { id: meter.id, eventName: meter.eventName },
              },
            ],
            tx,
          );

          return meter;
        }

        throw new NotFoundError(`Meter ${id} could not be created`);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(`A meter already listens for event ${payload.eventName}`, {
          param: 'eventName',
          cause: error,
        });
      }

      throw error;
    }
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const meter = await this.fastify.meterRepository.getMeter(id);

      return { createdAt: meter.createdAt, id: meter.id };
    }

    return undefined;
  }
}
