import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreateProductPayload,
  GetProductsQuery,
  ProductResponse,
  UpdateProductPayload,
} from '@contracts/products.types';
import type { Product } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class ProductService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createProduct(payload: CreateProductPayload): Promise<ProductResponse> {
    const now = this.fastify.clock.now();
    const id = generateId(ObjectPrefixEnum.PRODUCT);

    const createdProduct = await this.fastify.database.master.transaction(async (tx) => {
      const product = await this.fastify.productRepository.createProduct(
        {
          id,
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

      if (!product) {
        throw new NotFoundError(`Product ${id} could not be created`);
      }

      await this.fastify.outboxService.recordEvents(
        [
          {
            aggregateType: AggregateTypeEnum.PRODUCT,
            aggregateId: product.id,
            eventType: DomainEventTypeEnum.PRODUCT_CREATED,
            payload: { id: product.id },
          },
        ],
        tx,
      );

      return product;
    });

    return ProductService.buildProduct(createdProduct);
  }

  async getProduct(id: string): Promise<ProductResponse> {
    const product = await this.fastify.productRepository.findProduct(id);

    if (product) {
      return ProductService.buildProduct(product);
    }

    throw new NotFoundError(`No such product: ${id}`);
  }

  async updateProduct(id: string, payload: UpdateProductPayload): Promise<ProductResponse> {
    await this.getProduct(id);

    const updatedProduct = await this.fastify.database.master.transaction(async (tx) => {
      const product = await this.fastify.productRepository.updateProduct(
        id,
        { ...payload, updatedAt: this.fastify.clock.now() },
        tx,
      );

      if (!product) {
        throw new NotFoundError(`No such product: ${id}`);
      }

      await this.fastify.outboxService.recordEvents(
        [
          {
            aggregateType: AggregateTypeEnum.PRODUCT,
            aggregateId: product.id,
            eventType: DomainEventTypeEnum.PRODUCT_UPDATED,
            payload: { id: product.id },
          },
        ],
        tx,
      );

      return product;
    });

    return ProductService.buildProduct(updatedProduct);
  }

  async findProducts(query: GetProductsQuery): Promise<ListResponse<ProductResponse>> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.productRepository.findProducts(
      { active: query.active, beforeAt, afterAt },
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
    if (!id) {
      return undefined;
    }

    const product = await this.fastify.productRepository.findProduct(id);

    if (!product) {
      throw new NotFoundError(`No such product: ${id}`);
    }

    return { createdAt: product.createdAt, id: product.id };
  }

  private static buildProduct(entity: Product): ProductResponse {
    return {
      object: 'product',
      id: entity.id,
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
