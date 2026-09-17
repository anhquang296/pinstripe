import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreateProductPayload,
  FindProductsQuery,
  ProductResponse,
  UpdateProductPayload,
} from '@contracts/products.types';
import type { Product } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class ProductService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createProduct(payload: CreateProductPayload, livemode: boolean): Promise<ProductResponse> {
    const now = this.fastify.clock.now();
    const id = generateGid(ObjectPrefixEnum.PRODUCT);

    const createdProduct = await this.fastify.database.master.transaction(async (tx) => {
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

    return ProductService.buildProduct(createdProduct);
  }

  async getProduct(id: string, livemode: boolean): Promise<ProductResponse> {
    const product = await this.fastify.productRepository.findProduct(id);

    if (product && product.livemode === livemode) {
      return ProductService.buildProduct(product);
    }

    throw new NotFoundError(`No such product: ${id}`);
  }

  async updateProduct(
    id: string,
    payload: UpdateProductPayload,
    livemode: boolean,
  ): Promise<ProductResponse> {
    await this.getProduct(id, livemode);

    const updatedProduct = await this.fastify.database.master.transaction(async (tx) => {
      const product = await this.fastify.productRepository.updateProduct(
        id,
        { ...payload, updatedAt: this.fastify.clock.now() },
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

    return ProductService.buildProduct(updatedProduct);
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
      object: 'list',
      url: '/v1/products',
      hasMore,
      data: _(rows).take(limit).map(ProductService.buildProduct).value(),
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

  static buildProduct(entity: Product): ProductResponse {
    return {
      object: 'product',
      id: entity.id,
      livemode: entity.livemode,
      name: entity.name,
      description: entity.description,
      active: entity.active,
      unitLabel: entity.unitLabel,
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
