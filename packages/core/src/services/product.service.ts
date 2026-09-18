import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreateProductPayload,
  FindProductsQuery,
  ProductResponse,
  UpdateProductPayload,
} from '@contracts/products.types';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class ProductService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createProduct(payload: CreateProductPayload, livemode: boolean): Promise<ProductResponse> {
    const now = this.fastify.clock.now().toISOString();
    const id = generateGid(ObjectPrefixEnum.PRODUCT);

    return this.fastify.database.master.transaction(async (tx) => {
      const product = await this.fastify.productRepository.createProduct(
        {
          id,
          livemode,
          name: payload.name,
          description: payload.description ?? '',
          active: payload.active ?? true,
          unitLabel: payload.unitLabel ?? '',
          metadata: payload.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        },
        tx,
      );

      if (product) {
        await this.fastify.outboxService.recordEvents(
          [
            {
              aggregateType: AggregateTypeEnum.PRODUCT,
              aggregateId: product.id,
              livemode: product.livemode,
              eventType: DomainEventTypeEnum.PRODUCT_CREATED,
              payload: { id: product.id },
            },
          ],
          tx,
        );

        return product;
      }

      throw new NotFoundError(`Product ${id} could not be created`);
    });
  }

  async getProduct(id: string, livemode: boolean): Promise<ProductResponse> {
    const product = await this.fastify.productRepository.findProduct(id);

    if (product && product.livemode === livemode) {
      return product;
    }

    throw new NotFoundError(`No such product: ${id}`);
  }

  async updateProduct(
    id: string,
    payload: UpdateProductPayload,
    livemode: boolean,
  ): Promise<ProductResponse> {
    await this.getProduct(id, livemode);

    return this.fastify.database.master.transaction(async (tx) => {
      const product = await this.fastify.productRepository.updateProduct(
        id,
        { ...payload, updatedAt: this.fastify.clock.now().toISOString() },
        tx,
      );

      if (product) {
        await this.fastify.outboxService.recordEvents(
          [
            {
              aggregateType: AggregateTypeEnum.PRODUCT,
              aggregateId: product.id,
              livemode: product.livemode,
              eventType: DomainEventTypeEnum.PRODUCT_UPDATED,
              payload: { id: product.id },
            },
          ],
          tx,
        );

        return product;
      }

      throw new NotFoundError(`No such product: ${id}`);
    });
  }

  async findProducts(
    query: FindProductsQuery,
    livemode: boolean,
  ): Promise<ListResponse<ProductResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.productRepository.findProducts(
      { livemode, active: query.active, beforeAt, afterAt },
      limit + 1,
    );
    const hasMore = rows.length > limit;

    return {
      url: '/v1/products',
      hasMore,
      data: _.take(rows, limit),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const product = await this.fastify.productRepository.findProduct(id);

      if (product) {
        return { createdAt: product.createdAt, id: product.id };
      }

      throw new NotFoundError(`No such product: ${id}`);
    }

    return undefined;
  }
}
