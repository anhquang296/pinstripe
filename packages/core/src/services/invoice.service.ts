import { MILLISECONDS_PER_DAY } from '@constants/time';
import { CustomerBalanceTransactionTypeEnum } from '@contracts/customers.types';
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
import { CollectionMethodEnum } from '@contracts/subscriptions.types';
import type { DatabaseTransaction } from '@database/database.client';
import type {
  Customer,
  Invoice,
  InvoiceLineDiscountAmount,
  InvoiceLineItem,
  InvoiceLineTaxAmount,
  NewInvoiceLineItem,
  Subscription,
} from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import { isUniqueViolation } from '@errors/database.error';
import type { RowCursor } from '@repositories/cursor';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { LineItemType } from '@utils/rating';
import { LineItemTypeEnum } from '@utils/rating';
import type { FastifyInstance } from 'fastify';
import _ from 'lodash';

const INVOICE_NUMBER_PREFIX = 'INV';
const NUMBER_PAD_LENGTH = 6;

export interface EnsuredInvoice {
  invoice: Invoice;
  isCreated: boolean;
}

export interface InvoiceDraftLine {
  subscriptionItemId: string | null;
  invoiceItemId: string | null;
  priceId: string | null;
  type: LineItemType;
  description: string;
  quantity: number;
  unitAmount: number | null;
  amount: number;
  discountable: boolean;
  discountAmounts: InvoiceLineDiscountAmount[];
  taxAmounts: InvoiceLineTaxAmount[];
  periodStart: Date;
  periodEnd: Date;
  prorationFactor: number;
}

export interface InvoiceTotals {
  subtotal: number;
  subtotalExcludingTax: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  total: number;
  startingBalance: number;
  endingBalance: number;
  amountDue: number;
}

export interface InvoiceServiceConfig {
  dueDays: number;
}

export class InvoiceService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly config: InvoiceServiceConfig,
  ) {}

  async createInvoice(payload: CreateInvoicePayload, livemode: boolean): Promise<InvoiceResponse> {
    const { subscriptionId, customerId } = payload;

    if (subscriptionId) {
      const subscription = await this.getSubscription(subscriptionId);
      const { invoice } = await this.ensureDraftInvoice(subscription, payload.metadata ?? {});

      return this.buildInvoice(invoice);
    }

    if (customerId) {
      const invoice = await this.writeStandaloneInvoice(customerId, payload, livemode);

      return this.buildInvoice(invoice);
    }

    throw new BadRequestError('An invoice needs either a customer or a subscription', {
      param: 'customerId',
    });
  }

  private async writeStandaloneInvoice(
    customerId: string,
    payload: CreateInvoicePayload,
    livemode: boolean,
  ): Promise<Invoice> {
    const customer = await this.fastify.customerService.getCustomer(customerId, livemode);
    const now = this.fastify.clock.now();
    const id = generateGid(ObjectPrefixEnum.INVOICE);

    const {
      collectionMethod = CollectionMethodEnum.CHARGE_AUTOMATICALLY,
      autoAdvance = true,
      daysUntilDue = null,
    } = payload;

    return this.fastify.database.master.transaction(async (tx) => {
      const invoice = await this.fastify.invoiceRepository.createInvoice(
        {
          id,
          livemode,
          number: null,
          customerId,
          subscriptionId: null,
          status: InvoiceStatusEnum.DRAFT,
          billingReason: BillingReasonEnum.MANUAL,
          currency: payload.currency ?? customer.currency,
          collectionMethod,
          autoAdvance,
          daysUntilDue,
          periodStart: now,
          periodEnd: now,
          metadata: payload.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        },
        tx,
      );

      if (invoice) {
        await this.recordInvoiceEvent(invoice, DomainEventTypeEnum.INVOICE_CREATED, tx);

        return invoice;
      }

      throw new NotFoundError(`Invoice ${id} could not be created`);
    });
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
            collectionMethod: subscription.collectionMethod,
            autoAdvance: true,
            daysUntilDue: null,
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

    const lines = await this.collectInvoiceLines(invoice);
    const now = this.fastify.clock.now();

    const finalizedInvoice = await this.fastify.database.master.transaction(async (tx) => {
      return this.writeFinalizedInvoice(invoice, lines, now, tx);
    });

    return this.buildInvoice(finalizedInvoice);
  }

  private async collectInvoiceLines(invoice: Invoice): Promise<InvoiceDraftLine[]> {
    const subscriptionLines = await this.collectSubscriptionLines(invoice);
    const invoiceItemLines = await this.collectInvoiceItemLines(invoice);

    return [...subscriptionLines, ...invoiceItemLines];
  }

  private async collectSubscriptionLines(invoice: Invoice): Promise<InvoiceDraftLine[]> {
    const { subscriptionId } = invoice;

    if (!subscriptionId) {
      return [];
    }

    const subscription = await this.getSubscription(subscriptionId);

    if (subscription.currentPeriodStart.getTime() !== invoice.periodStart.getTime()) {
      throw new ConflictError(
        `Invoice ${invoice.id} covers a period the subscription has already left and can no longer be rated`,
      );
    }

    const rated = await this.fastify.ratingService.rateUpcomingInvoice(subscriptionId);

    return _.map(rated.lineItems, (lineItem): InvoiceDraftLine => {
      return {
        subscriptionItemId: lineItem.subscriptionItemId,
        invoiceItemId: null,
        priceId: lineItem.priceId,
        type: lineItem.type,
        description: '',
        quantity: lineItem.quantity,
        unitAmount: null,
        amount: lineItem.amount,
        discountable: true,
        discountAmounts: [],
        taxAmounts: [],
        periodStart: new Date(lineItem.periodStart),
        periodEnd: new Date(lineItem.periodEnd),
        prorationFactor: lineItem.prorationFactor,
      };
    });
  }

  private async collectInvoiceItemLines(invoice: Invoice): Promise<InvoiceDraftLine[]> {
    const invoiceItems = await this.fastify.invoiceItemRepository.findInvoiceItems({
      livemode: invoice.livemode,
      customerId: invoice.customerId,
      currency: invoice.currency,
      pendingForInvoiceId: invoice.id,
    });

    return _.map(invoiceItems, (invoiceItem): InvoiceDraftLine => {
      return {
        subscriptionItemId: null,
        invoiceItemId: invoiceItem.id,
        priceId: invoiceItem.priceId,
        type: LineItemTypeEnum.INVOICEITEM,
        description: invoiceItem.description,
        quantity: invoiceItem.quantity,
        unitAmount: invoiceItem.unitAmount,
        amount: invoiceItem.amount,
        discountable: invoiceItem.discountable,
        discountAmounts: [],
        taxAmounts: [],
        periodStart: invoiceItem.periodStart,
        periodEnd: invoiceItem.periodEnd,
        prorationFactor: 1,
      };
    });
  }

  private static assembleInvoiceTotals(
    lines: readonly InvoiceDraftLine[],
    startingBalance: number,
  ): InvoiceTotals {
    const subtotal = _.sumBy(lines, 'amount');
    const totalDiscountAmount = _.sumBy(lines, (line) => {
      return _.sumBy(line.discountAmounts, 'amount');
    });
    const totalTaxAmount = _.sumBy(lines, (line) => {
      return _.sumBy(line.taxAmounts, 'amount');
    });
    const inclusiveTaxAmount = _.sumBy(lines, (line) => {
      return _.sumBy(_.filter(line.taxAmounts, 'isInclusive'), 'amount');
    });

    const total = subtotal - totalDiscountAmount + (totalTaxAmount - inclusiveTaxAmount);
    const settled = total + startingBalance;

    return {
      subtotal,
      subtotalExcludingTax: subtotal - inclusiveTaxAmount,
      totalDiscountAmount,
      totalTaxAmount,
      total,
      startingBalance,
      endingBalance: Math.min(settled, 0),
      amountDue: Math.max(settled, 0),
    };
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
        collectionMethod: subscription.collectionMethod,
        autoAdvance: true,
        daysUntilDue: null,
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

      const lines = _.map(rated.lineItems, (lineItem): InvoiceDraftLine => {
        return {
          subscriptionItemId: lineItem.subscriptionItemId,
          invoiceItemId: null,
          priceId: lineItem.priceId,
          type: lineItem.type,
          description: '',
          quantity: lineItem.quantity,
          unitAmount: null,
          amount: lineItem.amount,
          discountable: true,
          discountAmounts: [],
          taxAmounts: [],
          periodStart: new Date(lineItem.periodStart),
          periodEnd: new Date(lineItem.periodEnd),
          prorationFactor: lineItem.prorationFactor,
        };
      });

      const finalizedInvoice = await this.writeFinalizedInvoice(invoice, lines, now, tx);

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
    lines: readonly InvoiceDraftLine[],
    now: Date,
    tx: DatabaseTransaction,
  ): Promise<Invoice> {
    const customer = await this.getLockedCustomer(invoice.customerId, tx);
    const totals = InvoiceService.assembleInvoiceTotals(lines, customer.balance);
    const dueAt = this.resolveDueAt(invoice, now);

    const lineItems = _.map(lines, (line): NewInvoiceLineItem => {
      return {
        id: generateGid(ObjectPrefixEnum.INVOICE_LINE_ITEM),
        livemode: invoice.livemode,
        invoiceId: invoice.id,
        subscriptionItemId: line.subscriptionItemId,
        invoiceItemId: line.invoiceItemId,
        priceId: line.priceId,
        type: line.type,
        description: line.description,
        quantity: line.quantity,
        unitAmount: line.unitAmount,
        amount: line.amount,
        amountExcludingTax:
          line.amount - _.sumBy(_.filter(line.taxAmounts, 'isInclusive'), 'amount'),
        discountable: line.discountable,
        discountAmounts: line.discountAmounts,
        taxAmounts: line.taxAmounts,
        periodStart: line.periodStart,
        periodEnd: line.periodEnd,
        prorationFactor: line.prorationFactor,
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
    await this.fastify.invoiceItemRepository.attachInvoiceItems(
      _.compact(_.map(lines, 'invoiceItemId')),
      invoice.id,
      now,
      tx,
    );

    const updatedInvoice = await this.fastify.invoiceRepository.updateInvoice(
      invoice.id,
      {
        number: InvoiceService.formatNumber(INVOICE_NUMBER_PREFIX, sequenceValue),
        status: InvoiceStatusEnum.OPEN,
        ...totals,
        finalizedAt: now,
        dueAt,
        nextAttemptAt: InvoiceService.resolveNextAttemptAt(invoice, dueAt),
        updatedAt: now,
      },
      tx,
    );

    if (updatedInvoice) {
      await this.applyCustomerBalance(updatedInvoice, totals, now, tx);
      await this.postReceivable(updatedInvoice, totals, tx);
      await this.recordInvoiceEvent(updatedInvoice, DomainEventTypeEnum.INVOICE_FINALIZED, tx);

      return updatedInvoice;
    }

    throw new NotFoundError(`No such invoice: ${invoice.id}`);
  }

  private static resolveNextAttemptAt(invoice: Invoice, dueAt: Date): Date | null {
    if (invoice.collectionMethod === CollectionMethodEnum.CHARGE_AUTOMATICALLY) {
      return dueAt;
    }

    return null;
  }

  async advanceDraftInvoices(
    finalizeBeforeAt: Date,
    shardCount: number,
    shardIndex: number,
    limit: number,
  ): Promise<number> {
    const drafts = await this.fastify.invoiceRepository.findInvoices(
      {
        status: InvoiceStatusEnum.DRAFT,
        autoAdvance: true,
        createdBeforeAt: finalizeBeforeAt,
        shardCount,
        shardIndex,
      },
      limit,
    );

    let advanced = 0;

    for (const draft of drafts) {
      try {
        await this.finalizeInvoice(draft.id);
        advanced += 1;
      } catch (error) {
        this.fastify.log.error(
          { error, invoiceId: draft.id },
          '[InvoiceService] advanceDraftInvoices() error',
        );
      }
    }

    return advanced;
  }

  private resolveDueAt(invoice: Invoice, now: Date): Date {
    const { daysUntilDue } = invoice;

    if (daysUntilDue === null) {
      return new Date(now.getTime() + this.config.dueDays * MILLISECONDS_PER_DAY);
    }

    return new Date(now.getTime() + daysUntilDue * MILLISECONDS_PER_DAY);
  }

  private async getLockedCustomer(id: string, tx: DatabaseTransaction): Promise<Customer> {
    const customer = await this.fastify.customerRepository.lockCustomer(id, tx);

    if (customer) {
      return customer;
    }

    throw new NotFoundError(`No such customer: ${id}`);
  }

  private async applyCustomerBalance(
    invoice: Invoice,
    totals: InvoiceTotals,
    now: Date,
    tx: DatabaseTransaction,
  ): Promise<void> {
    const movement = totals.endingBalance - totals.startingBalance;

    if (movement === 0) {
      return;
    }

    await this.fastify.customerRepository.updateCustomer(
      invoice.customerId,
      { balance: totals.endingBalance, updatedAt: now },
      tx,
    );

    await this.fastify.customerBalanceTransactionRepository.createCustomerBalanceTransaction(
      {
        id: generateGid(ObjectPrefixEnum.CUSTOMER_BALANCE_TRANSACTION),
        livemode: invoice.livemode,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        creditNoteId: null,
        type: CustomerBalanceTransactionTypeEnum.APPLIED_TO_INVOICE,
        currency: invoice.currency,
        amount: movement,
        endingBalance: totals.endingBalance,
        description: `Applied to invoice ${invoice.number}`,
        metadata: {},
        createdAt: now,
      },
      tx,
    );
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
      const owed = invoice.amountDue - invoice.amountPaid - amountCredited;
      const amount = payload.amount ?? owed;

      if (amount > owed) {
        throw new BadRequestError(
          `Payment of ${amount} exceeds the ${owed} still owed on invoice ${id}`,
          { param: 'amount' },
        );
      }

      const amountPaid = invoice.amountPaid + amount;
      const isSettled = amountPaid + amountCredited >= invoice.amountDue;

      const updatedInvoice = await this.fastify.invoiceRepository.updateInvoice(
        invoice.id,
        {
          amountPaid,
          attempted: true,
          status: isSettled ? InvoiceStatusEnum.PAID : invoice.status,
          paidAt: isSettled ? now : null,
          updatedAt: now,
        },
        tx,
      );

      if (updatedInvoice) {
        await this.fastify.invoiceRepository.createInvoicePayment(
          {
            id: generateGid(ObjectPrefixEnum.INVOICE_PAYMENT),
            livemode: invoice.livemode,
            invoiceId: invoice.id,
            paymentIntentId: null,
            amount,
            settlementReference: settlementReference ?? null,
            paidAt: now,
            createdAt: now,
          },
          tx,
        );

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
          await this.restoreCustomerBalance(updatedInvoice, now, tx);
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

  async getInvoice(id: string, livemode: boolean): Promise<InvoiceResponse> {
    const invoice = await this.getInvoiceEntity(id);

    if (invoice.livemode === livemode) {
      return this.buildInvoice(invoice);
    }

    throw new NotFoundError(`No such invoice: ${id}`);
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

  private async postReceivable(
    invoice: Invoice,
    totals: InvoiceTotals,
    tx: DatabaseTransaction,
  ): Promise<void> {
    if (totals.total <= 0) {
      return;
    }

    const revenue = totals.total - totals.totalTaxAmount;
    const appliedBalance = totals.total - totals.amountDue;

    const entries = [
      {
        accountCode: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
        customerId: invoice.customerId,
        direction: PostingDirectionEnum.DEBIT,
        amount: totals.amountDue,
      },
      {
        accountCode: LedgerAccountCodeEnum.REVENUE,
        direction: PostingDirectionEnum.CREDIT,
        amount: revenue,
      },
    ];

    if (totals.totalTaxAmount > 0) {
      entries.push({
        accountCode: LedgerAccountCodeEnum.TAX_PAYABLE,
        direction: PostingDirectionEnum.CREDIT,
        amount: totals.totalTaxAmount,
      });
    }

    if (appliedBalance !== 0) {
      entries.push({
        accountCode: LedgerAccountCodeEnum.CUSTOMER_CREDIT_BALANCE,
        customerId: invoice.customerId,
        direction: appliedBalance > 0 ? PostingDirectionEnum.DEBIT : PostingDirectionEnum.CREDIT,
        amount: Math.abs(appliedBalance),
      });
    }

    await this.fastify.ledgerService.postTransaction(
      {
        description: `Invoice ${invoice.number} issued`,
        currency: invoice.currency,
        externalId: `invoice:${invoice.id}`,
        entries,
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

    const revenue = invoice.total - invoice.totalTaxAmount;
    const appliedBalance = invoice.total - invoice.amountDue;

    const entries = [
      {
        accountCode: LedgerAccountCodeEnum.REVENUE,
        direction: PostingDirectionEnum.DEBIT,
        amount: revenue,
      },
      {
        accountCode: LedgerAccountCodeEnum.ACCOUNTS_RECEIVABLE,
        customerId: invoice.customerId,
        direction: PostingDirectionEnum.CREDIT,
        amount: invoice.amountDue,
      },
    ];

    if (invoice.totalTaxAmount > 0) {
      entries.push({
        accountCode: LedgerAccountCodeEnum.TAX_PAYABLE,
        direction: PostingDirectionEnum.DEBIT,
        amount: invoice.totalTaxAmount,
      });
    }

    if (appliedBalance !== 0) {
      entries.push({
        accountCode: LedgerAccountCodeEnum.CUSTOMER_CREDIT_BALANCE,
        customerId: invoice.customerId,
        direction: appliedBalance > 0 ? PostingDirectionEnum.CREDIT : PostingDirectionEnum.DEBIT,
        amount: Math.abs(appliedBalance),
      });
    }

    await this.fastify.ledgerService.postTransaction(
      {
        description: `Invoice ${invoice.number} voided`,
        currency: invoice.currency,
        externalId: `invoice_void:${invoice.id}`,
        entries,
      },
      invoice.livemode,
      tx,
    );
  }

  private async restoreCustomerBalance(
    invoice: Invoice,
    now: Date,
    tx: DatabaseTransaction,
  ): Promise<void> {
    const movement = invoice.endingBalance - invoice.startingBalance;

    if (movement === 0) {
      return;
    }

    const customer = await this.getLockedCustomer(invoice.customerId, tx);
    const endingBalance = customer.balance - movement;

    await this.fastify.customerRepository.updateCustomer(
      invoice.customerId,
      { balance: endingBalance, updatedAt: now },
      tx,
    );

    await this.fastify.customerBalanceTransactionRepository.createCustomerBalanceTransaction(
      {
        id: generateGid(ObjectPrefixEnum.CUSTOMER_BALANCE_TRANSACTION),
        livemode: invoice.livemode,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        creditNoteId: null,
        type: CustomerBalanceTransactionTypeEnum.UNAPPLIED_FROM_INVOICE,
        currency: invoice.currency,
        amount: -movement,
        endingBalance,
        description: `Unapplied from invoice ${invoice.number}`,
        metadata: {},
        createdAt: now,
      },
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
      collectionMethod: invoice.collectionMethod,
      autoAdvance: invoice.autoAdvance,
      daysUntilDue: invoice.daysUntilDue,
      attempted: invoice.attempted,
      periodStart: invoice.periodStart.toISOString(),
      periodEnd: invoice.periodEnd.toISOString(),
      subtotal: invoice.subtotal,
      subtotalExcludingTax: invoice.subtotalExcludingTax,
      totalDiscountAmount: invoice.totalDiscountAmount,
      totalTaxAmount: invoice.totalTaxAmount,
      total: invoice.total,
      startingBalance: invoice.startingBalance,
      endingBalance: invoice.endingBalance,
      amountDue: invoice.amountDue,
      amountPaid: invoice.amountPaid,
      amountCredited,
      amountRefunded,
      amountRemaining: invoice.amountDue - invoice.amountPaid - amountCredited,
      lineItems: _.map(lineItems, (lineItem) => {
        return {
          object: 'line_item' as const,
          id: lineItem.id,
          subscriptionItemId: lineItem.subscriptionItemId,
          invoiceItemId: lineItem.invoiceItemId,
          priceId: lineItem.priceId,
          type: lineItem.type,
          description: lineItem.description,
          quantity: lineItem.quantity,
          unitAmount: lineItem.unitAmount,
          amount: lineItem.amount,
          amountExcludingTax: lineItem.amountExcludingTax,
          discountable: lineItem.discountable,
          discountAmounts: lineItem.discountAmounts,
          taxAmounts: lineItem.taxAmounts,
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
