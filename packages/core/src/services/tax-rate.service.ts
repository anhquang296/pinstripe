import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreateTaxRatePayload,
  FindTaxRatesQuery,
  TaxRateResponse,
  UpdateTaxRatePayload,
} from '@contracts/taxes.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { TaxRate } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class TaxRateService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createTaxRate(payload: CreateTaxRatePayload, livemode: boolean): Promise<TaxRateResponse> {
    const now = this.fastify.clock.now();
    const id = generateGid(ObjectPrefixEnum.TAX_RATE);

    const createdTaxRate = await this.fastify.database.master.transaction(async (tx) => {
      const taxRate = await this.fastify.taxRateRepository.createTaxRate(
        {
          id,
          livemode,
          displayName: payload.displayName,
          description: payload.description ?? '',
          percentage: payload.percentage,
          inclusive: payload.inclusive,
          jurisdiction: payload.jurisdiction ?? '',
          country: payload.country ?? null,
          state: payload.state ?? null,
          taxType: payload.taxType,
          active: payload.active ?? true,
          metadata: payload.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        },
        tx,
      );

      if (taxRate) {
        await this.recordTaxRateEvent(taxRate, DomainEventTypeEnum.TAX_RATE_CREATED, tx);

        return taxRate;
      }

      throw new NotFoundError(`Tax rate ${id} could not be created`);
    });

    return TaxRateService.buildTaxRate(createdTaxRate);
  }

  async getTaxRate(id: string, livemode: boolean): Promise<TaxRateResponse> {
    const taxRate = await this.getTaxRateEntity(id, livemode);

    return TaxRateService.buildTaxRate(taxRate);
  }

  async getTaxRateEntity(id: string, livemode: boolean): Promise<TaxRate> {
    const taxRate = await this.fastify.taxRateRepository.findTaxRate(id);

    if (taxRate && taxRate.livemode === livemode) {
      return taxRate;
    }

    throw new NotFoundError(`No such tax rate: ${id}`);
  }

  async updateTaxRate(
    id: string,
    payload: UpdateTaxRatePayload,
    livemode: boolean,
  ): Promise<TaxRateResponse> {
    const existingTaxRate = await this.getTaxRateEntity(id, livemode);
    const now = this.fastify.clock.now();

    const updatedTaxRate = await this.fastify.database.master.transaction(async (tx) => {
      const taxRate = await this.fastify.taxRateRepository.updateTaxRate(
        id,
        {
          displayName: payload.displayName ?? existingTaxRate.displayName,
          description: payload.description ?? existingTaxRate.description,
          jurisdiction: payload.jurisdiction ?? existingTaxRate.jurisdiction,
          active: payload.active ?? existingTaxRate.active,
          metadata: payload.metadata ?? existingTaxRate.metadata,
          updatedAt: now,
        },
        tx,
      );

      if (taxRate) {
        await this.recordTaxRateEvent(taxRate, DomainEventTypeEnum.TAX_RATE_UPDATED, tx);

        return taxRate;
      }

      throw new NotFoundError(`No such tax rate: ${id}`);
    });

    return TaxRateService.buildTaxRate(updatedTaxRate);
  }

  async findTaxRates(
    query: FindTaxRatesQuery,
    livemode: boolean,
  ): Promise<ListResponse<TaxRateResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter, livemode);
    const afterAt = await this.resolveCursor(query.endingBefore, livemode);

    const rows = await this.fastify.taxRateRepository.findTaxRates(
      {
        livemode,
        active: query.active,
        inclusive: query.inclusive,
        country: query.country,
        taxType: query.taxType,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );

    return {
      object: 'list',
      url: '/v1/tax_rates',
      hasMore: rows.length > limit,
      data: _(rows).take(limit).map(TaxRateService.buildTaxRate).value(),
    };
  }

  private async resolveCursor(
    id: string | undefined,
    livemode: boolean,
  ): Promise<RowCursor | undefined> {
    if (id) {
      const taxRate = await this.getTaxRateEntity(id, livemode);

      return { createdAt: taxRate.createdAt, id: taxRate.id };
    }

    return undefined;
  }

  private async recordTaxRateEvent(
    taxRate: TaxRate,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.TAX_RATE,
          aggregateId: taxRate.id,
          livemode: taxRate.livemode,
          eventType,
          payload: {
            id: taxRate.id,
            displayName: taxRate.displayName,
            percentage: taxRate.percentage,
            inclusive: taxRate.inclusive,
          },
        },
      ],
      tx,
    );
  }

  static buildTaxRate(entity: TaxRate): TaxRateResponse {
    return {
      object: 'tax_rate',
      id: entity.id,
      livemode: entity.livemode,
      displayName: entity.displayName,
      description: entity.description,
      percentage: entity.percentage,
      inclusive: entity.inclusive,
      jurisdiction: entity.jurisdiction,
      country: entity.country,
      state: entity.state,
      taxType: entity.taxType,
      active: entity.active,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
