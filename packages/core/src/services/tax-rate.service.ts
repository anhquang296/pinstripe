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

  async createTaxRate(payload: CreateTaxRatePayload): Promise<TaxRateResponse> {
    const now = this.fastify.clock.now().toISOString();
    const id = generateGid(ObjectPrefixEnum.TAX_RATE);
    const { description = '', jurisdiction = '', active = true, metadata = {} } = payload;

    return this.fastify.database.master.transaction(async (tx) => {
      const taxRate = await this.fastify.taxRateRepository.createTaxRate(
        {
          id,
          displayName: payload.displayName,
          description,
          percentage: payload.percentage,
          inclusive: payload.inclusive,
          jurisdiction,
          country: payload.country ?? null,
          state: payload.state ?? null,
          taxType: payload.taxType,
          active,
          metadata,
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
  }

  async getTaxRate(id: string): Promise<TaxRateResponse> {
    return this.fastify.taxRateRepository.getTaxRate(id);
  }

  async updateTaxRate(id: string, payload: UpdateTaxRatePayload): Promise<TaxRateResponse> {
    const existingTaxRate = await this.fastify.taxRateRepository.getTaxRate(id);
    const updatedAt = this.fastify.clock.now().toISOString();
    const {
      displayName = existingTaxRate.displayName,
      description = existingTaxRate.description,
      jurisdiction = existingTaxRate.jurisdiction,
      active = existingTaxRate.active,
      metadata = existingTaxRate.metadata,
    } = payload;

    return this.fastify.database.master.transaction(async (tx) => {
      const taxRate = await this.fastify.taxRateRepository.updateTaxRate(
        id,
        {
          displayName,
          description,
          jurisdiction,
          active,
          metadata,
          updatedAt,
        },
        tx,
      );

      if (taxRate) {
        await this.recordTaxRateEvent(taxRate, DomainEventTypeEnum.TAX_RATE_UPDATED, tx);

        return taxRate;
      }

      throw new NotFoundError(`No such tax rate: ${id}`);
    });
  }

  async findTaxRates(query: FindTaxRatesQuery): Promise<ListResponse<TaxRateResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);

    const rows = await this.fastify.taxRateRepository.findTaxRates(
      {
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
      url: '/v1/tax_rates',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const taxRate = await this.fastify.taxRateRepository.getTaxRate(id);

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
}
