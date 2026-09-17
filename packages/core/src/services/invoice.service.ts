import { MILLISECONDS_PER_DAY } from '@constants/time';
import { AggregateTypeEnum, DomainEventTypeEnum } from '@contracts/events.types';
import type {
  CreateInvoicePayload,
  FindInvoicesQuery,
  InvoiceResponse,
  InvoiceStatus,
  PayInvoicePayload,
  VoidInvoicePayload,
} from '@contracts/invoices.types';
import {
  BillingReasonEnum,
  INVOICE_TRANSITIONS,
  InvoiceStatusEnum,
  NumberSequenceEnum,
} from '@contracts/invoices.types';
import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@contracts/ledger.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import type { RatedInvoiceResponse } from '@contracts/rating.types';
import type { DatabaseTransaction } from '@database/database.client';
import type { Invoice, InvoiceLineItem, NewInvoiceLineItem, Subscription } from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import { isUniqueViolation } from '@errors/database.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const INVOICE_NUMBER_PREFIX = 'INV';
const NUMBER_PAD_LENGTH = 6;

export interface EnsuredInvoice {
  invoice: Invoice;
  isCreated: boolean;
}

export interface InvoiceServiceConfig {
  dueDays: number;
}

export class InvoiceService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly config: InvoiceServiceConfig,
  ) {}

  async createInvoice(payload: CreateInvoicePayload): Promise<InvoiceResponse> {
    const subscription = await this.getSubscription(payload.subscriptionId);
    const { invoice } = await this.ensureDraftInvoice(subscription, payload.metadata ?? {});

    return this.buildInvoice(invoice);
  }

  async ensureDraftInvoice(
    subscription: Subscription,
    metadata: Record<string, string>,
  ): Promise<EnsuredInvoice> {
    const existingInvoice = await this.findPeriodInvoice(subscription);

    if (existingInvoice) {
      return { invoice: existingInvoice, isCreated: false };
    }

    const id = generateGid(ObjectPrefixEnum.INVOICE);
    const now = this.fastify.clock.now();

    try {
      return await this.fastify.database.master.transaction(async (tx) => {
        const invoice = await this.fastify.invoiceRepository.createInvoice(
          {
            id,
            livemode: subscription.livemode,
            number: null,
            customerId: subscription.customerId,
            subscriptionId: subscription.id,
            status: InvoiceStatusEnum.DRAFT,
            billingReason: BillingReasonEnum.SUBSCRIPTION_CYCLE,
            currency: subscription.currency,
            periodStart: subscription.currentPeriodStart,
            periodEnd: subscription.currentPeriodEnd,
            subtotal: 0,
            total: 0,
            amountPaid: 0,
            finalizedAt: null,
            paidAt: null,
            voidedAt: null,
            metadata,
            createdAt: now,
            updatedAt: now,
          },
          tx,
        );

        if (invoice) {
          await this.recordInvoiceEvent(invoice, DomainEventTypeEnum.INVOICE_CREATED, tx);

          return { invoice, isCreated: true };
        }

        throw new NotFoundError(`Invoice ${id} could not be created`);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const racedInvoice = await this.findPeriodInvoice(subscription);

        if (racedInvoice) {
          return { invoice: racedInvoice, isCreated: false };
        }
      }

      throw error;
    }
  }

  async finalizeInvoice(id: string): Promise<InvoiceResponse> {
    const invoice = await this.getInvoiceEntity(id);

    InvoiceService.assertTransition(invoice.status, InvoiceStatusEnum.OPEN);

    if (!invoice.subscriptionId) {
      throw new BadRequestError(`Invoice ${id} has no subscription to rate`);
    }

    const subscription = await this.getSubscription(invoice.subscriptionId);

    if (subscription.currentPeriodStart.getTime() !== invoice.periodStart.getTime()) {
      throw new ConflictError(
        `Invoice ${id} covers a period the subscription has already left and can no longer be rated`,
      );
    }

    const rated = await this.fastify.ratingService.rateUpcomingInvoice(invoice.subscriptionId);
    const now = this.fastify.clock.now();

    const finalizedInvoice = await this.fastify.database.master.transaction(async (tx) => {
      return this.writeFinalizedInvoice(invoice, rated, now, tx);
    });

    return this.buildInvoice(finalizedInvoice);
  }

  async issueProrationInvoice(
    subscription: Subscription,
    now: Date,
    tx: DatabaseTransaction,
  ): Promise<Invoice | null> {
    const rated = await this.fastify.ratingService.rateProrationInvoice(subscription.id, tx);

    if (_.isEmpty(rated.lineItems) || rated.total <= 0) {
      return null;
    }

    const id = generateGid(ObjectPrefixEnum.INVOICE);
    const invoice = await this.fastify.invoiceRepository.createInvoice(
      {
        id,
        livemode: subscription.livemode,
        number: null,
        customerId: subscription.customerId,
        subscriptionId: subscription.id,
        status: InvoiceStatusEnum.DRAFT,
        billingReason: BillingReasonEnum.SUBSCRIPTION_UPDATE,
        currency: subscription.currency,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        subtotal: 0,
        total: 0,
        amountPaid: 0,
        finalizedAt: null,
        paidAt: null,
        voidedAt: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
      tx,
    );

    if (invoice) {
      await this.recordInvoiceEvent(invoice, DomainEventTypeEnum.INVOICE_CREATED, tx);

      const finalizedInvoice = await this.writeFinalizedInvoice(invoice, rated, now, tx);

      await this.fastify.subscriptionRepository.markSubscriptionItemsInvoiced(
        _.map(rated.lineItems, 'subscriptionItemId'),
        tx,
      );

      return finalizedInvoice;
    }

    throw new NotFoundError(`Invoice ${id} could not be created`);
  }

  private async writeFinalizedInvoice(
    invoice: Invoice,
    rated: RatedInvoiceResponse,
    now: Date,
    tx: DatabaseTransaction,
  ): Promise<Invoice> {
    const dueAt = new Date(now.getTime() + this.config.dueDays * MILLISECONDS_PER_DAY);
    const lineItems = _.map(rated.lineItems, (lineItem): NewInvoiceLineItem => {
      return {
        id: generateGid(ObjectPrefixEnum.INVOICE_LINE_ITEM),
        livemode: invoice.livemode,
        invoiceId: invoice.id,
        subscriptionItemId: lineItem.subscriptionItemId,
        priceId: lineItem.priceId,
        type: lineItem.type,
        quantity: lineItem.quantity,
        amount: lineItem.amount,
        periodStart: new Date(lineItem.periodStart),
        periodEnd: new Date(lineItem.periodEnd),
        prorationFactor: lineItem.prorationFactor,
        createdAt: now,
      };
    });

    const sequenceValue = await this.fastify.numberSequenceRepository.claimNumberSequence(
      NumberSequenceEnum.INVOICE,
      tx,
    );

    if (sequenceValue === null) {
      throw new NotFoundError('Invoice number sequence is not provisioned');
    }

    await this.fastify.invoiceRepository.createInvoiceLineItems(lineItems, tx);

    const updatedInvoice = await this.fastify.invoiceRepository.updateInvoice(
      invoice.id,
      {
        number: InvoiceService.formatNumber(INVOICE_NUMBER_PREFIX, sequenceValue),
        status: InvoiceStatusEnum.OPEN,
        subtotal: rated.total,
        total: rated.total,
        finalizedAt: now,
        dueAt,
        nextAttemptAt: dueAt,
        updatedAt: now,
      },
      tx,
    );

    if (updatedInvoice) {
      await this.postReceivable(updatedInvoice, tx);
      await this.recordInvoiceEvent(updatedInvoice, DomainEventTypeEnum.INVOICE_FINALIZED, tx);

      return updatedInvoice;
    }

    throw new NotFoundError(`No such invoice: ${invoice.id}`);
  }

  async payInvoice(
    id: string,
    payload: PayInvoicePayload,
    settlementReference?: string,
  ): Promise<InvoiceResponse> {
    const now = this.fastify.clock.now();

    const paidInvoice = await this.fastify.database.master.transaction(async (tx) => {
      const invoice = await this.getLockedInvoiceEntity(id, tx);

      InvoiceService.assertTransition(invoice.status, InvoiceStatusEnum.PAID);

      const creditedByInvoiceId = await this.resolveCreditedAmounts([invoice.id]);
      const amountCredited = creditedByInvoiceId[invoice.id] ?? 0;
      const owed = invoice.total - invoice.amountPaid - amountCredited;
      const amount = payload.amount ?? owed;

      if (amount > owed) {
        throw new BadRequestError(
          `Payment of ${amount} exceeds the ${owed} still owed on invoice ${id}`,
          { param: 'amount' },
        );
      }

      const amountPaid = invoice.amountPaid + amount;
      const isSettled = amountPaid + amountCredited >= invoice.total;

      const updatedInvoice = await this.fastify.invoiceRepository.updateInvoice(
        invoice.id,
        {
          amountPaid,
          status: isSettled ? InvoiceStatusEnum.PAID : invoice.status,
          paidAt: isSettled ? now : null,
          updatedAt: now,
        },
        tx,
      );

      if (updatedInvoice) {
        await this.postCashReceipt(updatedInvoice, amount, settlementReference, tx);

        if (isSettled) {
          await this.recordInvoiceEvent(updatedInvoice, DomainEventTypeEnum.INVOICE_PAID, tx);
        }

        return updatedInvoice;
      }

      throw new NotFoundError(`No such invoice: ${invoice.id}`);
    });

    return this.buildInvoice(paidInvoice);
  }

  async voidInvoice(id: string, payload: VoidInvoicePayload): Promise<InvoiceResponse> {
    const invoice = await this.getInvoiceEntity(id);

    InvoiceService.assertTransition(invoice.status, InvoiceStatusEnum.VOID);

    if (invoice.amountPaid > 0) {
      throw new ConflictError(
        `Invoice ${id} has been paid and can only be corrected with a credit note`,
      );
    }

    const now = this.fastify.clock.now();

    const voidedInvoice = await this.fastify.database.master.transaction(async (tx) => {
      const updatedInvoice = await this.fastify.invoiceRepository.updateInvoice(
        invoice.id,
        {
          status: InvoiceStatusEnum.VOID,
          voidedAt: now,
          metadata: { ...invoice.metadata, ...(payload.metadata ?? {}) },
          updatedAt: now,
        },
        tx,
      );

      if (updatedInvoice) {
        if (invoice.status === InvoiceStatusEnum.OPEN) {
          await this.reverseReceivable(updatedInvoice, tx);
        }

        if (invoice.billingReason === BillingReasonEnum.SUBSCRIPTION_UPDATE) {
          await this.reopenInvoicedItems(invoice.id, tx);
        }

        await this.recordInvoiceEvent(updatedInvoice, DomainEventTypeEnum.INVOICE_VOIDED, tx);

        return updatedInvoice;
      }

      throw new NotFoundError(`No such invoice: ${invoice.id}`);
    });

    return this.buildInvoice(voidedInvoice);
  }

  async getInvoice(id: string): Promise<InvoiceResponse> {
    const invoice = await this.getInvoiceEntity(id);

    return this.buildInvoice(invoice);
  }

  async findInvoices(
    query: FindInvoicesQuery,
    livemode: boolean,
  ): Promise<ListResponse<InvoiceResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.invoiceRepository.findInvoices(
      {
        livemode,
        customerId: query.customerId,
        subscriptionId: query.subscriptionId,
        status: query.status,
        beforeAt,
        afterAt,
      },
      limit + 1,
    );
    const page = _.take(rows, limit);
    const invoiceIds = _.map(page, 'id');
    const lineItemsByInvoiceId = await this.resolveLineItems(invoiceIds);
    const creditedByInvoiceId = await this.resolveCreditedAmounts(invoiceIds);
    const refundedByInvoiceId = await this.resolveRefundedAmounts(invoiceIds);

    return {
      object: 'list',
      url: '/v1/invoices',
      hasMore: rows.length > limit,
      data: _.map(page, (invoice) => {
        const lineItems = _.get(lineItemsByInvoiceId, invoice.id, []);
        const amountCredited = _.get(creditedByInvoiceId, invoice.id, 0);
        const amountRefunded = _.get(refundedByInvoiceId, invoice.id, 0);

        return InvoiceService.buildInvoiceWithLineItems(
          invoice,
          lineItems,
          amountCredited,
          amountRefunded,
        );
      }),
    };
  }

  private async reopenInvoicedItems(invoiceId: string, tx: DatabaseTransaction): Promise<void> {
    const lineItems = await this.fastify.invoiceRepository.findInvoiceLineItems([invoiceId]);
    const subscriptionItemIds = _.compact(_.map(lineItems, 'subscriptionItemId'));

    await this.fastify.subscriptionRepository.reopenSubscriptionItemInvoicing(
      subscriptionItemIds,
      tx,
    );
  }

  private async findPeriodInvoice(subscription: Subscription): Promise<Invoice | null> {
    const [invoice] = await this.fastify.invoiceRepository.findInvoices(
      {
        subscriptionId: subscription.id,
        billingReason: BillingReasonEnum.SUBSCRIPTION_CYCLE,
        periodStart: subscription.currentPeriodStart,
      },
      1,
    );

    return invoice ?? null;
  }

  private async postReceivable(invoice: Invoice, tx: DatabaseTransaction): Promise<void> {
    if (invoice.total <= 0) {
      return;
    }

    await this.fastify.ledgerService.postTransaction(
      {
        description: `Invoice ${invoice.number} issued`,
        currency: invoice.currency,
        externalId: `invoice:${invoice.id}`,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
            customerId: invoice.customerId,
            direction: PostingDirectionEnum.DEBIT,
            amount: invoice.total,
          },
          {
            accountCode: LedgerAccountCodeEnum.REVENUE,
            direction: PostingDirectionEnum.CREDIT,
            amount: invoice.total,
          },
        ],
      },
      invoice.livemode,
      tx,
    );
  }

  private async postCashReceipt(
    invoice: Invoice,
    amount: number,
    settlementReference: string | undefined,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.ledgerService.postTransaction(
      {
        description: `Invoice ${invoice.number} payment`,
        currency: invoice.currency,
        externalId: settlementReference ?? `invoice_payment:${invoice.id}:${invoice.amountPaid}`,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.CASH,
            direction: PostingDirectionEnum.DEBIT,
            amount,
          },
          {
            accountCode: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
            customerId: invoice.customerId,
            direction: PostingDirectionEnum.CREDIT,
            amount,
          },
        ],
      },
      invoice.livemode,
      tx,
    );
  }

  private async reverseReceivable(invoice: Invoice, tx: DatabaseTransaction): Promise<void> {
    if (invoice.total <= 0) {
      return;
    }

    await this.fastify.ledgerService.postTransaction(
      {
        description: `Invoice ${invoice.number} voided`,
        currency: invoice.currency,
        externalId: `invoice_void:${invoice.id}`,
        entries: [
          {
            accountCode: LedgerAccountCodeEnum.REVENUE,
            direction: PostingDirectionEnum.DEBIT,
            amount: invoice.total,
          },
          {
            accountCode: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
            customerId: invoice.customerId,
            direction: PostingDirectionEnum.CREDIT,
            amount: invoice.total,
          },
        ],
      },
      invoice.livemode,
      tx,
    );
  }

  private async recordInvoiceEvent(
    invoice: Invoice,
    eventType: DomainEventTypeEnum,
    tx: DatabaseTransaction,
  ): Promise<void> {
    await this.fastify.outboxService.recordEvents(
      [
        {
          aggregateType: AggregateTypeEnum.INVOICE,
          aggregateId: invoice.id,
          livemode: invoice.livemode,
          eventType,
          payload: {
            id: invoice.id,
            number: invoice.number,
            customerId: invoice.customerId,
            total: invoice.total,
          },
        },
      ],
      tx,
    );
  }

  private async getSubscription(id: string): Promise<Subscription> {
    const subscription = await this.fastify.subscriptionRepository.findSubscription(id);

    if (subscription) {
      return subscription;
    }

    throw new NotFoundError(`No such subscription: ${id}`);
  }

  private async getInvoiceEntity(id: string): Promise<Invoice> {
    const invoice = await this.fastify.invoiceRepository.findInvoice(id);

    if (invoice) {
      return invoice;
    }

    throw new NotFoundError(`No such invoice: ${id}`);
  }

  private async getLockedInvoiceEntity(id: string, tx: DatabaseTransaction): Promise<Invoice> {
    const invoice = await this.fastify.invoiceRepository.lockInvoice(id, tx);

    if (invoice) {
      return invoice;
    }

    throw new NotFoundError(`No such invoice: ${id}`);
  }

  private async resolveCursor(id: string | undefined): Promise<RowCursor | undefined> {
    if (id) {
      const invoice = await this.getInvoiceEntity(id);

      return { createdAt: invoice.createdAt, id: invoice.id };
    }

    return undefined;
  }

  private async resolveLineItems(
    invoiceIds: readonly string[],
  ): Promise<Record<string, InvoiceLineItem[]>> {
    const rows = await this.fastify.invoiceRepository.findInvoiceLineItems(invoiceIds);

    return _.groupBy(rows, 'invoiceId');
  }

  private async buildInvoice(invoice: Invoice): Promise<InvoiceResponse> {
    const lineItems = await this.fastify.invoiceRepository.findInvoiceLineItems([invoice.id]);
    const creditedByInvoiceId = await this.resolveCreditedAmounts([invoice.id]);
    const refundedByInvoiceId = await this.resolveRefundedAmounts([invoice.id]);

    const amountCredited = _.get(creditedByInvoiceId, invoice.id, 0);
    const amountRefunded = _.get(refundedByInvoiceId, invoice.id, 0);

    return InvoiceService.buildInvoiceWithLineItems(
      invoice,
      lineItems,
      amountCredited,
      amountRefunded,
    );
  }

  private async resolveCreditedAmounts(
    invoiceIds: readonly string[],
  ): Promise<Record<string, number>> {
    const rows = await this.fastify.creditNoteRepository.aggregateCreditedAmounts(invoiceIds);

    return _.mapValues(_.keyBy(rows, 'invoiceId'), 'creditedAmount');
  }

  private async resolveRefundedAmounts(
    invoiceIds: readonly string[],
  ): Promise<Record<string, number>> {
    const rows = await this.fastify.refundRepository.aggregateRefundedAmounts(invoiceIds);

    return _.mapValues(_.keyBy(rows, 'invoiceId'), 'refundedAmount');
  }

  private static formatNumber(prefix: string, value: number): string {
    return `${prefix}-${_.padStart(String(value), NUMBER_PAD_LENGTH, '0')}`;
  }

  private static assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
    if (_.includes(INVOICE_TRANSITIONS[from], to)) {
      return;
    }

    throw new ConflictError(`An invoice cannot move from ${from} to ${to}`);
  }

  private static buildInvoiceWithLineItems(
    invoice: Invoice,
    lineItems: readonly InvoiceLineItem[],
    amountCredited: number,
    amountRefunded: number,
  ): InvoiceResponse {
    return {
      object: 'invoice',
      id: invoice.id,
      number: invoice.number,
      customerId: invoice.customerId,
      subscriptionId: invoice.subscriptionId,
      status: invoice.status,
      billingReason: invoice.billingReason,
      currency: invoice.currency,
      periodStart: invoice.periodStart.toISOString(),
      periodEnd: invoice.periodEnd.toISOString(),
      subtotal: invoice.subtotal,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      amountCredited,
      amountRefunded,
      amountRemaining: invoice.total - invoice.amountPaid - amountCredited,
      lineItems: _.map(lineItems, (lineItem) => {
        return {
          object: 'line_item' as const,
          id: lineItem.id,
          subscriptionItemId: lineItem.subscriptionItemId,
          priceId: lineItem.priceId,
          type: lineItem.type,
          quantity: lineItem.quantity,
          amount: lineItem.amount,
          periodStart: lineItem.periodStart.toISOString(),
          periodEnd: lineItem.periodEnd.toISOString(),
          prorationFactor: lineItem.prorationFactor,
        };
      }),
      finalizedAt: invoice.finalizedAt ? invoice.finalizedAt.toISOString() : null,
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      voidedAt: invoice.voidedAt ? invoice.voidedAt.toISOString() : null,
      metadata: invoice.metadata,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }
}
