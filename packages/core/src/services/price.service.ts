import type { FastifyInstance } from 'fastify';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreatePricePayload,
  GetPricesQuery,
  Price,
  UpdatePricePayload,
} from '@contracts/prices.types';
import {
  BillingSchemeEnum,
  PriceTypeEnum,
  TaxBehaviorEnum,
  UsageTypeEnum,
} from '@contracts/prices.types';
import type { PriceEntity } from '@database/schemas';
import { BadRequestError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';

const DEFAULT_INTERVAL_COUNT = 1;

export class PriceService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createPrice(payload: CreatePricePayload): Promise<Price> {
    await this.fastify.productService.getProduct(payload.productId);

    const billingScheme = payload.billingScheme ?? BillingSchemeEnum.PER_UNIT;

    PriceService.assertPriceShape(payload, billingScheme);

    const now = this.fastify.clock.now();
    const id = generateId(ObjectPrefixEnum.PRICE);
    const version = await this.resolveNextVersion(payload.lookupKey);

    const created = await this.fastify.database.master.transaction(async (tx) => {
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

    return PriceService.buildPrice(created);
  }

  async getPrice(id: string): Promise<Price> {
    const price = await this.fastify.priceRepository.findPrice(id);

    if (price) {
      return PriceService.buildPrice(price);
    }

    throw new NotFoundError(`No such price: ${id}`);
  }

  async updatePrice(id: string, payload: UpdatePricePayload): Promise<Price> {
    await this.getPrice(id);

    const updated = await this.fastify.database.master.transaction(async (tx) => {
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

    return PriceService.buildPrice(updated);
  }

  async resolvePrice(lookupKey: string, at: Date): Promise<Price> {
    const price = await this.fastify.priceRepository.findEffectivePrice(lookupKey, at);

    if (price) {
      return PriceService.buildPrice(price);
    }

    throw new NotFoundError(
      `No price effective for lookup key ${lookupKey} at ${at.toISOString()}`,
    );
  }

  async findPrices(query: GetPricesQuery): Promise<ListResponse<Price>> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const beforeCursor = await this.resolveCursor(query.startingAfter);
    const afterCursor = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.priceRepository.findPrices(
      {
        productIdEq: query.productId,
        lookupKeyEq: query.lookupKey,
        activeEq: query.active,
        beforeCursor,
        afterCursor,
      },
      limit + 1,
    );
    const hasMore = rows.length > limit;

    return {
      object: 'list',
      url: '/v1/prices',
      hasMore,
      data: rows.slice(0, limit).map(PriceService.buildPrice),
    };
  }

  private async resolveNextVersion(lookupKey: string | undefined): Promise<number> {
    if (!lookupKey) {
      return 1;
    }

    const latest = await this.fastify.priceRepository.findLatestPriceVersion(lookupKey);

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

  private static buildPrice(entity: PriceEntity): Price {
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
