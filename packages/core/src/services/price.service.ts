import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  BillingScheme,
  CreatePricePayload,
  GetPricesQuery,
  PriceResponse,
  UpdatePricePayload,
} from '@contracts/prices.types';
import {
  BillingSchemeEnum,
  PriceTypeEnum,
  TaxBehaviorEnum,
  UsageTypeEnum,
} from '@contracts/prices.types';
import type { Price } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import { isUniqueViolation } from '@errors/database.error';
import type { RowCursor } from '@repositories/cursor';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const DEFAULT_INTERVAL_COUNT = 1;

export class PriceService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createPrice(payload: CreatePricePayload): Promise<PriceResponse> {
    await this.fastify.productService.getProduct(payload.productId);

    const billingScheme = payload.billingScheme ?? BillingSchemeEnum.PER_UNIT;

    PriceService.assertPriceShape(payload, billingScheme);

    const now = this.fastify.clock.now();
    const id = generateId(ObjectPrefixEnum.PRICE);
    const version = await this.resolveNextVersion(payload.lookupKey);

    const createdPrice = await this.writePrice(id, payload, billingScheme, version, now);

    return PriceService.buildPrice(createdPrice);
  }

  private async writePrice(
    id: string,
    payload: CreatePricePayload,
    billingScheme: BillingScheme,
    version: number,
    now: Date,
  ): Promise<Price> {
    try {
      return await this.fastify.database.master.transaction(async (tx) => {
        const price = await this.fastify.priceRepository.createPrice(
          {
            id,
            productId: payload.productId,
            lookupKey: payload.lookupKey ?? null,
            version,
            effectiveAt: payload.effectiveAt ? new Date(payload.effectiveAt) : now,
            active: true,
            nickname: payload.nickname ?? '',
            currency: payload.currency,
            type: payload.recurring ? PriceTypeEnum.RECURRING : PriceTypeEnum.ONE_TIME,
            billingScheme,
            unitAmount: payload.unitAmount ?? null,
            taxBehavior: payload.taxBehavior ?? TaxBehaviorEnum.UNSPECIFIED,
            recurringInterval: payload.recurring?.interval ?? null,
            recurringIntervalCount: payload.recurring
              ? (payload.recurring.intervalCount ?? DEFAULT_INTERVAL_COUNT)
              : null,
            usageType: payload.recurring
              ? (payload.recurring.usageType ?? UsageTypeEnum.LICENSED)
              : null,
            tiersMode: payload.tiersMode ?? null,
            tiers: payload.tiers ?? null,
            transformQuantity: payload.transformQuantity ?? null,
            metadata: payload.metadata ?? {},
            createdAt: now,
            updatedAt: now,
          },
          tx,
        );

        if (!price) {
          throw new NotFoundError(`Price ${id} could not be created`);
        }

        await this.fastify.outboxService.recordEvents(
          [
            {
              aggregateType: AggregateTypeEnum.PRICE,
              aggregateId: price.id,
              eventType: DomainEventTypeEnum.PRICE_CREATED,
              payload: { id: price.id, productId: price.productId, version: price.version },
            },
          ],
          tx,
        );

        return price;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          `A price version ${version} already exists for lookup key ${payload.lookupKey}`,
          { param: 'lookupKey', cause: error },
        );
      }

      throw error;
    }
  }

  async getPrice(id: string): Promise<PriceResponse> {
    const price = await this.fastify.priceRepository.findPrice(id);

    if (price) {
      return PriceService.buildPrice(price);
    }

    throw new NotFoundError(`No such price: ${id}`);
  }

  async updatePrice(id: string, payload: UpdatePricePayload): Promise<PriceResponse> {
    await this.getPrice(id);

    const updatedPrice = await this.fastify.database.master.transaction(async (tx) => {
      const price = await this.fastify.priceRepository.updatePrice(
        id,
        {
          active: payload.active,
          nickname: payload.nickname,
          metadata: payload.metadata,
          updatedAt: this.fastify.clock.now(),
        },
        tx,
      );

      if (!price) {
        throw new NotFoundError(`No such price: ${id}`);
      }

      await this.fastify.outboxService.recordEvents(
        [
          {
            aggregateType: AggregateTypeEnum.PRICE,
            aggregateId: price.id,
            eventType: DomainEventTypeEnum.PRICE_UPDATED,
            payload: { id: price.id },
          },
        ],
        tx,
      );

      return price;
    });

    return PriceService.buildPrice(updatedPrice);
  }

  async resolvePrice(lookupKey: string, at: Date): Promise<PriceResponse> {
    const price = await this.fastify.priceRepository.findEffectivePrice(lookupKey, at);

    if (price) {
      return PriceService.buildPrice(price);
    }

    throw new NotFoundError(
      `No price effective for lookup key ${lookupKey} at ${at.toISOString()}`,
    );
  }

  async findPrices(query: GetPricesQuery): Promise<ListResponse<PriceResponse>> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.priceRepository.findPrices(
      {
        productId: query.productId,
        lookupKey: query.lookupKey,
        active: query.active,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );
    const hasMore = rows.length > limit;

    return {
      object: 'list',
      url: '/v1/prices',
      hasMore,
      data: _(rows).take(limit).map(PriceService.buildPrice).value(),
    };
  }

  private async resolveNextVersion(lookupKey: string | undefined): Promise<number> {
    if (!lookupKey) {
      return 1;
    }

    const latest = await this.fastify.priceRepository.findLatestPrice(lookupKey);

    return latest ? latest.version + 1 : 1;
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (!id) {
      return undefined;
    }

    const price = await this.fastify.priceRepository.findPrice(id);

    if (!price) {
      throw new NotFoundError(`No such price: ${id}`);
    }

    return { createdAt: price.createdAt, id: price.id };
  }

  private static assertPriceShape(payload: CreatePricePayload, billingScheme: string): void {
    if (billingScheme === BillingSchemeEnum.PER_UNIT && payload.unitAmount === undefined) {
      throw new BadRequestError('unitAmount is required when billingScheme is per_unit', {
        param: 'unitAmount',
      });
    }

    if (billingScheme === BillingSchemeEnum.TIERED && !payload.tiers) {
      throw new BadRequestError('tiers is required when billingScheme is tiered', {
        param: 'tiers',
      });
    }

    if (billingScheme === BillingSchemeEnum.TIERED && !payload.tiersMode) {
      throw new BadRequestError('tiersMode is required when billingScheme is tiered', {
        param: 'tiersMode',
      });
    }

    if (payload.tiers && payload.tiers.at(-1)?.upTo !== null) {
      throw new BadRequestError('The last tier must have upTo set to null to catch all usage', {
        param: 'tiers',
      });
    }
  }

  private static buildPrice(entity: Price): PriceResponse {
    return {
      object: 'price',
      id: entity.id,
      productId: entity.productId,
      lookupKey: entity.lookupKey,
      version: entity.version,
      effectiveAt: entity.effectiveAt.toISOString(),
      active: entity.active,
      nickname: entity.nickname,
      currency: entity.currency,
      type: entity.type,
      billingScheme: entity.billingScheme,
      unitAmount: entity.unitAmount,
      taxBehavior: entity.taxBehavior,
      recurring:
        entity.recurringInterval && entity.recurringIntervalCount && entity.usageType
          ? {
              interval: entity.recurringInterval,
              intervalCount: entity.recurringIntervalCount,
              usageType: entity.usageType,
            }
          : null,
      tiersMode: entity.tiersMode,
      tiers: entity.tiers,
      transformQuantity: entity.transformQuantity,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
