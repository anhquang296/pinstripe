import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  BillingScheme,
  CreatePricePayload,
  FindPricesQuery,
  PriceResponse,
  UpdatePricePayload,
  UsageType,
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
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const DEFAULT_INTERVAL_COUNT = 1;

export class PriceService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createPrice(payload: CreatePricePayload): Promise<PriceResponse> {
    await this.fastify.productService.getProduct(payload.productId);

    const { billingScheme = BillingSchemeEnum.PER_UNIT } = payload;

    const { usageType } = PriceService.buildRecurringColumns(payload.recurring);

    PriceService.assertPriceShape(payload, billingScheme, usageType);

    if (payload.meterId) {
      await this.fastify.meterService.getMeter(payload.meterId);
    }

    const now = this.fastify.clock.now().toISOString();
    const id = generateGid(ObjectPrefixEnum.PRICE);
    const version = await this.resolveNextVersion(payload.lookupKey);

    const createdPrice = await this.writePrice(id, payload, billingScheme, version, now);

    return PriceService.buildPrice(createdPrice);
  }

  private async writePrice(
    id: string,
    payload: CreatePricePayload,
    billingScheme: BillingScheme,
    version: number,
    now: string,
  ): Promise<Price> {
    const effectiveAt = PriceService.resolveEffectiveAt(payload.effectiveAt, now);
    const {
      nickname = '',
      taxBehavior = TaxBehaviorEnum.UNSPECIFIED,
      metadata = {},
      recurring,
    } = payload;
    const type = recurring ? PriceTypeEnum.RECURRING : PriceTypeEnum.ONE_TIME;
    const recurringColumns = PriceService.buildRecurringColumns(recurring);

    try {
      return await this.fastify.database.master.transaction(async (tx) => {
        const price = await this.fastify.priceRepository.createPrice(
          {
            id,
            productId: payload.productId,
            lookupKey: payload.lookupKey ?? null,
            version,
            effectiveAt,
            active: true,
            nickname,
            currency: payload.currency,
            type,
            billingScheme,
            unitAmount: payload.unitAmount ?? null,
            taxBehavior,
            ...recurringColumns,
            meterId: payload.meterId ?? null,
            tiersMode: payload.tiersMode ?? null,
            tiers: payload.tiers ?? null,
            transformQuantity: payload.transformQuantity ?? null,
            metadata,
            createdAt: now,
            updatedAt: now,
          },
          tx,
        );

        if (price) {
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
        }

        throw new NotFoundError(`Price ${id} could not be created`);
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
    const price = await this.fastify.priceRepository.getPrice(id);

    return PriceService.buildPrice(price);
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
          updatedAt: this.fastify.clock.now().toISOString(),
        },
        tx,
      );

      if (price) {
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
      }

      throw new NotFoundError(`No such price: ${id}`);
    });

    return PriceService.buildPrice(updatedPrice);
  }

  async resolvePrice(lookupKey: string, at: Date): Promise<PriceResponse> {
    const price = await this.fastify.priceRepository.findEffectivePrice(
      lookupKey,
      at.toISOString(),
    );

    if (price) {
      return PriceService.buildPrice(price);
    }

    throw new NotFoundError(
      `No price effective for lookup key ${lookupKey} at ${at.toISOString()}`,
    );
  }

  async findPrices(query: FindPricesQuery): Promise<ListResponse<PriceResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);
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
      url: '/v1/prices',
      hasMore,
      data: _(rows).take(limit).map(PriceService.buildPrice).value(),
    };
  }

  private async resolveNextVersion(lookupKey: string | undefined): Promise<number> {
    if (lookupKey) {
      const latestPrice = await this.fastify.priceRepository.findLatestPrice(lookupKey);

      if (latestPrice) {
        return latestPrice.version + 1;
      }
    }

    return 1;
  }

  private static buildRecurringColumns(
    recurring: CreatePricePayload['recurring'],
  ): Pick<Price, 'recurringInterval' | 'recurringIntervalCount' | 'usageType'> {
    if (recurring) {
      const {
        interval,
        intervalCount = DEFAULT_INTERVAL_COUNT,
        usageType = UsageTypeEnum.LICENSED,
      } = recurring;

      return { recurringInterval: interval, recurringIntervalCount: intervalCount, usageType };
    }

    return { recurringInterval: null, recurringIntervalCount: null, usageType: null };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const price = await this.fastify.priceRepository.getPrice(id);

      return { createdAt: price.createdAt, id: price.id };
    }

    return undefined;
  }

  private static assertPriceShape(
    payload: CreatePricePayload,
    billingScheme: string,
    usageType: UsageType | null,
  ): void {
    if (usageType === UsageTypeEnum.METERED && !payload.meterId) {
      throw new BadRequestError('meterId is required when recurring.usageType is metered', {
        param: 'meterId',
      });
    }

    if (usageType !== UsageTypeEnum.METERED && payload.meterId) {
      throw new BadRequestError('meterId is only allowed when recurring.usageType is metered', {
        param: 'meterId',
      });
    }

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

  private static resolveEffectiveAt(effectiveAt: string | undefined, now: string): string {
    if (effectiveAt) {
      return new Date(effectiveAt).toISOString();
    }

    return now;
  }

  private static buildPrice(entity: Price): PriceResponse {
    const recurring =
      entity.recurringInterval && entity.recurringIntervalCount && entity.usageType
        ? {
            interval: entity.recurringInterval,
            intervalCount: entity.recurringIntervalCount,
            usageType: entity.usageType,
          }
        : null;

    return {
      id: entity.id,
      productId: entity.productId,
      lookupKey: entity.lookupKey,
      version: entity.version,
      effectiveAt: entity.effectiveAt,
      active: entity.active,
      nickname: entity.nickname,
      currency: entity.currency,
      type: entity.type,
      billingScheme: entity.billingScheme,
      unitAmount: entity.unitAmount,
      taxBehavior: entity.taxBehavior,
      recurring,
      meterId: entity.meterId,
      tiersMode: entity.tiersMode,
      tiers: entity.tiers,
      transformQuantity: entity.transformQuantity,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
    };
  }
}
