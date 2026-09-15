import type { FastifyInstance } from 'fastify';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type {
  CreateProductPayload,
  GetProductsQuery,
  Product,
  UpdateProductPayload,
} from '@contracts/products.types';
import type { ProductEntity } from '@database/schemas';
import { NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateId, ObjectPrefixEnum } from '@utils/id-factory';

export class ProductService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createProduct(payload: CreateProductPayload): Promise<Product> {
    const now = this.fastify.clock.now();
    const id = generateId(ObjectPrefixEnum.PRODUCT);

    const created = await this.fastify.database.master.transaction(async (tx) => {
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

    return ProductService.buildProduct(created);
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.fastify.productRepository.findProduct(id);

    if (product) {
      return ProductService.buildProduct(product);
    }

    throw new NotFoundError(`No such product: ${id}`);
  }

  async updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
    await this.getProduct(id);

    const updated = await this.fastify.database.master.transaction(async (tx) => {
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

    return ProductService.buildProduct(updated);
  }

  async findProducts(query: GetProductsQuery): Promise<ListResponse<Product>> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const beforeCursor = await this.resolveCursor(query.startingAfter);
    const afterCursor = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.productRepository.findProducts(
      { activeEq: query.active, beforeCursor, afterCursor },
      limit + 1,
    );
    const hasMore = rows.length > limit;

    return {
      object: 'list',
      url: '/v1/products',
      hasMore,
      data: rows.slice(0, limit).map(ProductService.buildProduct),
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

  private static buildProduct(entity: ProductEntity): Product {
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
