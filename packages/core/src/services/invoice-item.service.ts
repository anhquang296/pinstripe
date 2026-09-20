import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type {
  CreateInvoiceItemPayload,
  DeletedInvoiceItemResponse,
  FindInvoiceItemsQuery,
  InvoiceItemResponse,
  UpdateInvoiceItemPayload,
} from '@contracts/invoices.types';
import { InvoiceStatusEnum } from '@contracts/invoices.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { InvoiceItem } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

export class InvoiceItemService {
  constructor(private readonly fastify: FastifyInstance) {}

  async createInvoiceItem(payload: CreateInvoiceItemPayload): Promise<InvoiceItemResponse> {
    const customer = await this.fastify.customerService.getCustomer(payload.customerId);

    const now = this.fastify.clock.now().toISOString();

    const id = generateGid(ObjectPrefixEnum.INVOICE_ITEM);

    const {
      quantity = 1,
      currency = customer.currency,
      description = '',
      discountable = true,
      taxRates = [],
      periodStart = now,
      periodEnd = now,
      metadata = {},
    } = payload;

    const amount = await this.resolveAmount(payload, quantity);

    await this.assertInvoiceIsDraft(payload.invoiceId);

    return this.fastify.database.master.transaction(async (tx) => {
      const invoiceItem = await this.fastify.invoiceItemRepository.createInvoiceItem(
        {
          id,
          customerId: payload.customerId,
          invoiceId: payload.invoiceId ?? null,
          subscriptionId: payload.subscriptionId ?? null,
          priceId: payload.priceId ?? null,
          currency,
          description,
          quantity,
          unitAmount: payload.unitAmount ?? null,
          amount,
          discountable,
          taxRates,
          periodStart,
          periodEnd,
          metadata,
          createdAt: now,
          updatedAt: now,
        },
        tx,
      );

      if (invoiceItem) {
        await this.recordInvoiceItemEvent(invoiceItem, DomainEventTypeEnum.INVOICEITEM_CREATED, tx);

        return invoiceItem;
      }

      throw new NotFoundError(`Invoice item ${id} could not be created`);
    });
  }

  private async resolveAmount(
    payload: CreateInvoiceItemPayload,
    quantity: number,
  ): Promise<number> {
    if (payload.amount !== undefined) {
      return payload.amount;
    }

    if (payload.unitAmount !== undefined) {
      return payload.unitAmount * quantity;
    }

    const { priceId } = payload;

    if (priceId) {
      const price = await this.fastify.priceService.getPrice(priceId);

      const { unitAmount } = price;

      if (unitAmount !== null) {
        return unitAmount * quantity;
      }

      throw new BadRequestError(`Price ${priceId} has no unit amount to bill from`, {
        param: 'priceId',
      });
    }

    throw new BadRequestError('An invoice item needs an amount, a unit amount or a price', {
      param: 'amount',
    });
  }

  private async assertInvoiceIsDraft(invoiceId: string | undefined): Promise<void> {
    if (!invoiceId) {
      return;
    }

    const invoice = await this.fastify.invoiceService.getInvoice(invoiceId);

    if (invoice.status === InvoiceStatusEnum.DRAFT) {
      return;
    }

    throw new ConflictError(`Invoice ${invoiceId} has been issued and takes no further items`);
  }

  async getInvoiceItem(id: string): Promise<InvoiceItemResponse> {
    return this.fastify.invoiceItemRepository.getInvoiceItem(id);
  }

  async updateInvoiceItem(
    id: string,
    payload: UpdateInvoiceItemPayload,
  ): Promise<InvoiceItemResponse> {
    const existingInvoiceItem = await this.getInvoiceItem(id);

    await this.assertInvoiceIsDraft(existingInvoiceItem.invoiceId ?? undefined);

    const {
      quantity = existingInvoiceItem.quantity,
      unitAmount = existingInvoiceItem.unitAmount,
      description = existingInvoiceItem.description,
      discountable = existingInvoiceItem.discountable,
      taxRates = existingInvoiceItem.taxRates,
      metadata = existingInvoiceItem.metadata,
    } = payload;

    const amount = InvoiceItemService.resolveUpdatedAmount(
      payload,
      quantity,
      unitAmount,
      existingInvoiceItem.amount,
    );

    const updatedAt = this.fastify.clock.now().toISOString();

    return this.fastify.database.master.transaction(async (tx) => {
      const invoiceItem = await this.fastify.invoiceItemRepository.updateInvoiceItem(
        id,
        {
          description,
          quantity,
          unitAmount,
          amount,
          discountable,
          taxRates,
          metadata,
          updatedAt,
        },
        tx,
      );

      if (invoiceItem) {
        await this.recordInvoiceItemEvent(invoiceItem, DomainEventTypeEnum.INVOICEITEM_UPDATED, tx);

        return invoiceItem;
      }

      throw new NotFoundError(`No such invoice item: ${id}`);
    });
  }

  private static resolveUpdatedAmount(
    payload: UpdateInvoiceItemPayload,
    quantity: number,
    unitAmount: number | null,
    currentAmount: number,
  ): number {
    if (payload.amount !== undefined) {
      return payload.amount;
    }

    if (unitAmount !== null) {
      return unitAmount * quantity;
    }

    return currentAmount;
  }

  async deleteInvoiceItem(id: string): Promise<DeletedInvoiceItemResponse> {
    const invoiceItem = await this.getInvoiceItem(id);

    await this.assertInvoiceIsDraft(invoiceItem.invoiceId ?? undefined);

    const deletedAt = this.fastify.clock.now().toISOString();

    await this.fastify.database.master.transaction(async (tx) => {
      await this.fastify.invoiceItemRepository.archiveInvoiceItem(id, deletedAt, tx);

      await this.fastify.outboxService.recordEvents(
        [
          {
            aggregateType: AggregateTypeEnum.INVOICEITEM,
            aggregateId: id,
            eventType: DomainEventTypeEnum.INVOICEITEM_DELETED,
            payload: { id },
          },
        ],
        tx,
      );
    });

    return { id, deleted: true };
  }

  async findInvoiceItems(query: FindInvoiceItemsQuery): Promise<ListResponse<InvoiceItemResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const beforeAt = await this.resolveCursor(query.after);
    const afterAt = await this.resolveCursor(query.before);

    const rows = await this.fastify.invoiceItemRepository.findInvoiceItems(
      {
        customerId: query.customerId,
        invoiceId: query.invoiceId,
        invoiceIdIsNull: query.isPending,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );

    return {
      url: '/v1/invoiceitems',
      hasMore: rows.length > limit,
      data: _.take(rows, limit),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const invoiceItem = await this.fastify.invoiceItemRepository.getInvoiceItem(id);

      return { createdAt: invoiceItem.createdAt, id: invoiceItem.id };
    }

    return undefined;
  }

  private async recordInvoiceItemEvent(
    invoiceItem: InvoiceItem,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.INVOICEITEM,
          aggregateId: invoiceItem.id,
          eventType,
          payload: { id: invoiceItem.id, customerId: invoiceItem.customerId },
        },
      ],
      tx,
    );
  }
}
