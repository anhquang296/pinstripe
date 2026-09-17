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

  async createInvoiceItem(
    payload: CreateInvoiceItemPayload,
    livemode: boolean,
  ): Promise<InvoiceItemResponse> {
    const customer = await this.fastify.customerService.getCustomer(payload.customerId, livemode);

    const now = this.fastify.clock.now();

    const id = generateGid(ObjectPrefixEnum.INVOICE_ITEM);

    const { quantity = 1 } = payload;
    const amount = await this.resolveAmount(payload, quantity, livemode);

    await this.assertInvoiceIsDraft(payload.invoiceId, livemode);

    const createdInvoiceItem = await this.fastify.database.master.transaction(async (tx) => {
      const invoiceItem = await this.fastify.invoiceItemRepository.createInvoiceItem(
        {
          id,
          livemode,
          customerId: payload.customerId,
          invoiceId: payload.invoiceId ?? null,
          subscriptionId: payload.subscriptionId ?? null,
          priceId: payload.priceId ?? null,
          currency: payload.currency ?? customer.currency,
          description: payload.description ?? '',
          quantity,
          unitAmount: payload.unitAmount ?? null,
          amount,
          discountable: payload.discountable ?? true,
          taxRates: payload.taxRates ?? [],
          periodStart: payload.periodStart ? new Date(payload.periodStart) : now,
          periodEnd: payload.periodEnd ? new Date(payload.periodEnd) : now,
          metadata: payload.metadata ?? {},
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

    return InvoiceItemService.buildInvoiceItem(createdInvoiceItem);
  }

  private async resolveAmount(
    payload: CreateInvoiceItemPayload,
    quantity: number,
    livemode: boolean,
  ): Promise<number> {
    if (payload.amount !== undefined) {
      return payload.amount;
    }

    if (payload.unitAmount !== undefined) {
      return payload.unitAmount * quantity;
    }

    const { priceId } = payload;

    if (priceId) {
      const price = await this.fastify.priceService.getPrice(priceId, livemode);
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

  private async assertInvoiceIsDraft(
    invoiceId: string | undefined,
    livemode: boolean,
  ): Promise<void> {
    if (!invoiceId) {
      return;
    }

    const invoice = await this.fastify.invoiceService.getInvoice(invoiceId, livemode);

    if (invoice.status === InvoiceStatusEnum.DRAFT) {
      return;
    }

    throw new ConflictError(`Invoice ${invoiceId} has been issued and takes no further items`);
  }

  async getInvoiceItem(id: string, livemode: boolean): Promise<InvoiceItemResponse> {
    const invoiceItem = await this.fastify.invoiceItemRepository.findInvoiceItem(id);

    if (invoiceItem && invoiceItem.livemode === livemode) {
      return InvoiceItemService.buildInvoiceItem(invoiceItem);
    }

    throw new NotFoundError(`No such invoice item: ${id}`);
  }

  async updateInvoiceItem(
    id: string,
    payload: UpdateInvoiceItemPayload,
    livemode: boolean,
  ): Promise<InvoiceItemResponse> {
    const existingInvoiceItem = await this.getInvoiceItem(id, livemode);

    await this.assertInvoiceIsDraft(existingInvoiceItem.invoiceId ?? undefined, livemode);

    const quantity = payload.quantity ?? existingInvoiceItem.quantity;
    const unitAmount = payload.unitAmount ?? existingInvoiceItem.unitAmount;

    const amount = InvoiceItemService.resolveUpdatedAmount(
      payload,
      quantity,
      unitAmount,
      existingInvoiceItem.amount,
    );

    const now = this.fastify.clock.now();

    const updatedInvoiceItem = await this.fastify.database.master.transaction(async (tx) => {
      const invoiceItem = await this.fastify.invoiceItemRepository.updateInvoiceItem(
        id,
        {
          description: payload.description ?? existingInvoiceItem.description,
          quantity,
          unitAmount,
          amount,
          discountable: payload.discountable ?? existingInvoiceItem.discountable,
          taxRates: payload.taxRates ?? existingInvoiceItem.taxRates,
          metadata: payload.metadata ?? existingInvoiceItem.metadata,
          updatedAt: now,
        },
        tx,
      );

      if (invoiceItem) {
        await this.recordInvoiceItemEvent(invoiceItem, DomainEventTypeEnum.INVOICEITEM_UPDATED, tx);

        return invoiceItem;
      }

      throw new NotFoundError(`No such invoice item: ${id}`);
    });

    return InvoiceItemService.buildInvoiceItem(updatedInvoiceItem);
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

  async deleteInvoiceItem(id: string, livemode: boolean): Promise<DeletedInvoiceItemResponse> {
    const invoiceItem = await this.getInvoiceItem(id, livemode);

    await this.assertInvoiceIsDraft(invoiceItem.invoiceId ?? undefined, livemode);

    const now = this.fastify.clock.now();

    await this.fastify.database.master.transaction(async (tx) => {
      await this.fastify.invoiceItemRepository.archiveInvoiceItem(id, now, tx);

      await this.fastify.outboxService.recordEvents(
        [
          {
            aggregateType: AggregateTypeEnum.INVOICEITEM,
            aggregateId: id,
            livemode,
            eventType: DomainEventTypeEnum.INVOICEITEM_DELETED,
            payload: { id },
          },
        ],
        tx,
      );
    });

    return { object: 'invoiceitem', id, deleted: true };
  }

  async findInvoiceItems(
    query: FindInvoiceItemsQuery,
    livemode: boolean,
  ): Promise<ListResponse<InvoiceItemResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;

    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);

    const rows = await this.fastify.invoiceItemRepository.findInvoiceItems(
      {
        livemode,
        customerId: query.customerId,
        invoiceId: query.invoiceId,
        invoiceIdIsNull: query.isPending,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );

    return {
      object: 'list',
      url: '/v1/invoiceitems',
      hasMore: rows.length > limit,
      data: _(rows).take(limit).map(InvoiceItemService.buildInvoiceItem).value(),
    };
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const invoiceItem = await this.fastify.invoiceItemRepository.findInvoiceItem(id);

      if (invoiceItem) {
        return { createdAt: invoiceItem.createdAt, id: invoiceItem.id };
      }

      throw new NotFoundError(`No such invoice item: ${id}`);
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
          livemode: invoiceItem.livemode,
          eventType,
          payload: { id: invoiceItem.id, customerId: invoiceItem.customerId },
        },
      ],
      tx,
    );
  }

  static buildInvoiceItem(entity: InvoiceItem): InvoiceItemResponse {
    return {
      object: 'invoiceitem',
      id: entity.id,
      livemode: entity.livemode,
      customerId: entity.customerId,
      invoiceId: entity.invoiceId,
      subscriptionId: entity.subscriptionId,
      priceId: entity.priceId,
      currency: entity.currency,
      description: entity.description,
      quantity: entity.quantity,
      unitAmount: entity.unitAmount,
      amount: entity.amount,
      discountable: entity.discountable,
      taxRates: entity.taxRates,
      periodStart: entity.periodStart.toISOString(),
      periodEnd: entity.periodEnd.toISOString(),
      metadata: entity.metadata,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
