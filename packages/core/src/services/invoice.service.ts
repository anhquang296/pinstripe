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
  CreditNoteStatusEnum,
  INVOICE_TRANSITIONS,
  InvoiceStatusEnum,
  NumberSequenceEnum,
} from '@contracts/invoices.types';
import { LedgerAccountCodeEnum, PostingDirectionEnum } from '@contracts/ledger.types';
import type { ListResponse } from '@contracts/pagination.types';
import { DEFAULT_PAGE_LIMIT } from '@contracts/pagination.types';
import { RefundStatusEnum } from '@contracts/payments.types';
import type { TaxBehavior } from '@contracts/prices.types';
import { TaxBehaviorEnum } from '@contracts/prices.types';
import type { RatedInvoiceResponse } from '@contracts/rating.types';
import type { PauseCollectionBehavior } from '@contracts/subscriptions.types';
import {
  BillingModeEnum,
  CollectionMethodEnum,
  PauseCollectionBehaviorEnum,
} from '@contracts/subscriptions.types';
import type { DatabaseTransaction } from '@database/database.client';
import type {
  Customer,
  Invoice,
  InvoiceLineDiscountAmount,
  InvoiceLineItem,
  InvoiceLineItemTaxAmount,
  NewInvoiceLineItem,
  NewInvoiceLineItemTaxAmount,
  Subscription,
} from '@database/schemas';
import { BadRequestError, ConflictError, NotFoundError } from '@errors/app.error';
import { isUniqueViolation } from '@errors/database.error';
import type { RowCursor } from '@repositories/cursor';
import type { RatingPeriod } from '@services/rating.service';
import { advancePeriod } from '@utils/billing-period';
import { generateGid, ObjectPrefixEnum } from '@utils/gid-factory';
import type { LineItemType } from '@utils/rating';
import { LineItemTypeEnum } from '@utils/rating';
import type { SubscriptionInterval } from '@utils/subscription-price';
import type { LineTaxAmount } from '@utils/tax';
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
  subscriptionItemChangeId: string | null;
  invoiceItemId: string | null;
  priceId: string | null;
  type: LineItemType;
  description: string;
  quantity: number;
  unitAmount: number | null;
  amount: number;
  discountable: boolean;
  discountAmounts: InvoiceLineDiscountAmount[];
  taxAmounts: LineTaxAmount[];
  taxRateIds: string[];
  taxBehavior: TaxBehavior;
  periodStart: string;
  periodEnd: string;
  prorationFactor: number;
  isCredit: boolean;
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

export interface ApplyInvoicePaymentPayload {
  amount?: number;
  paymentIntentId?: string;
  chargeId?: string;
  settlementReference?: string;
}

export class InvoiceService {
  constructor(
    private readonly fastify: FastifyInstance,
    private readonly config: InvoiceServiceConfig,
  ) {}

  async createInvoice(payload: CreateInvoicePayload): Promise<InvoiceResponse> {
    const { subscriptionId, customerId } = payload;

    if (subscriptionId) {
      const subscription = await this.getSubscription(subscriptionId);
      const { invoice } = await this.ensureDraftInvoice(
        subscription,
        payload.metadata ?? {},
        InvoiceService.readCurrentPeriod(subscription),
      );

      return this.buildInvoice(invoice);
    }

    if (customerId) {
      const invoice = await this.writeStandaloneInvoice(customerId, payload);

      return this.buildInvoice(invoice);
    }

    throw new BadRequestError('An invoice needs either a customer or a subscription', {
      param: 'customerId',
    });
  }

  private async writeStandaloneInvoice(
    customerId: string,
    payload: CreateInvoicePayload,
  ): Promise<Invoice> {
    const customer = await this.fastify.customerService.getCustomer(customerId);
    const now = await this.fastify.clockService.resolveCustomerNow(customerId);
    const createdAt = now.toISOString();
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
          number: null,
          customerId,
          subscriptionId: null,
          status: InvoiceStatusEnum.DRAFT,
          billingReason: BillingReasonEnum.MANUAL,
          currency: payload.currency ?? customer.currency,
          collectionMethod,
          autoAdvance,
          daysUntilDue,
          periodStart: createdAt,
          periodEnd: createdAt,
          defaultTaxRates: payload.defaultTaxRates ?? [],
          automaticTaxEnabled: _.get(payload.automaticTax, 'enabled', false),
          metadata: payload.metadata ?? {},
          createdAt,
          updatedAt: createdAt,
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
    period: RatingPeriod,
  ): Promise<EnsuredInvoice> {
    const periodStart = period.periodStart.toISOString();
    const existingInvoice = await this.findPeriodInvoice(subscription, periodStart);

    if (existingInvoice) {
      return { invoice: existingInvoice, isCreated: false };
    }

    const id = generateGid(ObjectPrefixEnum.INVOICE);
    const now = await this.fastify.clockService.resolveSubscriptionNow(subscription);
    const createdAt = now.toISOString();

    try {
      return await this.fastify.database.master.transaction(async (tx) => {
        const invoice = await this.fastify.invoiceRepository.createInvoice(
          {
            id,
            number: null,
            customerId: subscription.customerId,
            subscriptionId: subscription.id,
            status: InvoiceStatusEnum.DRAFT,
            billingReason: BillingReasonEnum.SUBSCRIPTION_CYCLE,
            currency: subscription.currency,
            collectionMethod: subscription.collectionMethod,
            autoAdvance: true,
            daysUntilDue: null,
            periodStart,
            periodEnd: period.periodEnd.toISOString(),
            subtotal: 0,
            total: 0,
            amountPaid: 0,
            defaultTaxRates: subscription.defaultTaxRates,
            finalizedAt: null,
            paidAt: null,
            voidedAt: null,
            metadata,
            createdAt,
            updatedAt: createdAt,
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
        const racedInvoice = await this.findPeriodInvoice(subscription, periodStart);

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
    const now = await this.fastify.clockService.resolveInvoiceNow(invoice);

    const finalizedInvoice = await this.fastify.database.master.transaction(async (tx) => {
      return this.writeFinalizedInvoice(invoice, lines, now, tx);
    });
    const sentInvoice = await this.issueInvoiceDocument(finalizedInvoice);

    return this.buildInvoice(sentInvoice);
  }

  private async issueInvoiceDocument(invoice: Invoice): Promise<Invoice> {
    try {
      return await this.fastify.invoiceDocumentService.issueInvoiceDocument(invoice);
    } catch (error) {
      this.fastify.log.error(
        { error, invoiceId: invoice.id },
        '[InvoiceService] issueInvoiceDocument() error',
      );

      return invoice;
    }
  }

  async ensureBillableDraft(subscription: Subscription): Promise<EnsuredInvoice> {
    const ensured = await this.ensureDraftInvoice(
      subscription,
      {},
      InvoiceService.readCurrentPeriod(subscription),
    );
    const { pauseCollectionBehavior } = subscription;

    if (!ensured.isCreated) {
      return ensured;
    }

    if (pauseCollectionBehavior) {
      await this.applyPauseCollection(ensured.invoice, pauseCollectionBehavior);

      return ensured;
    }

    if (subscription.billingMode === BillingModeEnum.ADVANCE) {
      await this.finalizeInvoice(ensured.invoice.id);

      return { invoice: await this.getInvoiceEntity(ensured.invoice.id), isCreated: true };
    }

    return ensured;
  }

  async issueSubscriptionCreateInvoice(
    subscription: Subscription,
    now: Date,
  ): Promise<InvoiceResponse> {
    const id = generateGid(ObjectPrefixEnum.INVOICE);
    const createdAt = now.toISOString();

    const draft = await this.fastify.database.master.transaction(async (tx) => {
      const invoice = await this.fastify.invoiceRepository.createInvoice(
        {
          id,
          number: null,
          customerId: subscription.customerId,
          subscriptionId: subscription.id,
          status: InvoiceStatusEnum.DRAFT,
          billingReason: BillingReasonEnum.SUBSCRIPTION_CREATE,
          currency: subscription.currency,
          collectionMethod: subscription.collectionMethod,
          autoAdvance: true,
          daysUntilDue: null,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
          defaultTaxRates: subscription.defaultTaxRates,
          metadata: {},
          createdAt,
          updatedAt: createdAt,
        },
        tx,
      );

      if (invoice) {
        await this.recordInvoiceEvent(invoice, DomainEventTypeEnum.INVOICE_CREATED, tx);

        return invoice;
      }

      throw new NotFoundError(`Invoice ${id} could not be created`);
    });

    return this.finalizeInvoice(draft.id);
  }

  async issueTrailingInvoice(
    subscription: Subscription,
    endedAt: Date,
    interval: SubscriptionInterval,
  ): Promise<Invoice | null> {
    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: [subscription.id],
      deletedAtIsNull: true,
    });

    await this.fastify.subscriptionRepository.closeSubscriptionItemChanges(
      _.map(subscriptionItems, 'id'),
      endedAt.toISOString(),
    );

    const period: RatingPeriod = {
      periodStart: endedAt,
      periodEnd: advancePeriod(endedAt, interval.interval, interval.intervalCount),
    };
    const rated = await this.fastify.ratingService.rateInvoicePeriod(
      subscription.id,
      period.periodStart,
      period.periodEnd,
    );

    if (_.isEmpty(rated.lineItems)) {
      return null;
    }

    const { invoice, isCreated } = await this.ensureDraftInvoice(subscription, {}, period);

    if (isCreated) {
      await this.finalizeInvoice(invoice.id);
    }

    return this.getInvoiceEntity(invoice.id);
  }

  private static readCurrentPeriod(subscription: Subscription): RatingPeriod {
    return {
      periodStart: new Date(subscription.currentPeriodStart),
      periodEnd: new Date(subscription.currentPeriodEnd),
    };
  }

  async markInvoiceUncollectible(id: string): Promise<InvoiceResponse> {
    const invoice = await this.getInvoiceEntity(id);

    InvoiceService.assertTransition(invoice.status, InvoiceStatusEnum.UNCOLLECTIBLE);

    const now = await this.fastify.clockService.resolveInvoiceNow(invoice);

    const abandonedInvoice = await this.fastify.database.master.transaction(async (tx) => {
      const updatedInvoice = await this.fastify.invoiceRepository.updateInvoice(
        invoice.id,
        {
          status: InvoiceStatusEnum.UNCOLLECTIBLE,
          nextAttemptAt: null,
          updatedAt: now.toISOString(),
        },
        tx,
      );

      if (updatedInvoice) {
        await this.recordInvoiceEvent(
          updatedInvoice,
          DomainEventTypeEnum.INVOICE_MARKED_UNCOLLECTIBLE,
          tx,
        );

        return updatedInvoice;
      }

      throw new NotFoundError(`No such invoice: ${invoice.id}`);
    });

    return this.buildInvoice(abandonedInvoice);
  }

  async applyPauseCollection(
    invoice: Invoice,
    behavior: PauseCollectionBehavior,
  ): Promise<InvoiceResponse> {
    if (behavior === PauseCollectionBehaviorEnum.VOID) {
      return this.voidInvoice(invoice.id, {});
    }

    if (behavior === PauseCollectionBehaviorEnum.MARK_UNCOLLECTIBLE) {
      const open = await this.finalizeInvoice(invoice.id);

      return this.markInvoiceUncollectible(open.id);
    }

    const now = await this.fastify.clockService.resolveInvoiceNow(invoice);
    const held = await this.fastify.invoiceRepository.updateInvoice(invoice.id, {
      autoAdvance: false,
      updatedAt: now.toISOString(),
    });

    if (held) {
      return this.buildInvoice(held);
    }

    throw new NotFoundError(`No such invoice: ${invoice.id}`);
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
    const periodStart = new Date(invoice.periodStart);
    const periodEnd = new Date(invoice.periodEnd);
    const rated = await this.fastify.ratingService.rateInvoicePeriod(
      subscriptionId,
      periodStart,
      periodEnd,
    );

    return this.buildSubscriptionLines(subscription, rated.lineItems);
  }

  private async buildSubscriptionLines(
    subscription: Subscription,
    lineItems: RatedInvoiceResponse['lineItems'],
  ): Promise<InvoiceDraftLine[]> {
    const taxBehaviorByPriceId = await this.resolveTaxBehaviors(_.map(lineItems, 'priceId'));
    const subscriptionItems = await this.fastify.subscriptionRepository.findSubscriptionItems({
      subscriptionIds: [subscription.id],
    });
    const taxRateIdsBySubscriptionItemId = _.mapValues(
      _.keyBy(subscriptionItems, 'id'),
      'taxRates',
    );

    return _.map(lineItems, (lineItem): InvoiceDraftLine => {
      const itemTaxRateIds = _.get(taxRateIdsBySubscriptionItemId, lineItem.subscriptionItemId, []);

      return {
        subscriptionItemId: lineItem.subscriptionItemId,
        subscriptionItemChangeId: lineItem.subscriptionItemChangeId,
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
        taxRateIds: itemTaxRateIds,
        taxBehavior: _.get(taxBehaviorByPriceId, lineItem.priceId, TaxBehaviorEnum.UNSPECIFIED),
        periodStart: lineItem.periodStart,
        periodEnd: lineItem.periodEnd,
        prorationFactor: lineItem.prorationFactor,
        isCredit: lineItem.isCredit,
      };
    });
  }

  private async resolveTaxBehaviors(
    priceIds: readonly (string | null)[],
  ): Promise<Record<string, TaxBehavior>> {
    const ids = _.uniq(_.compact([...priceIds]));

    if (_.isEmpty(ids)) {
      return {};
    }

    const prices = await this.fastify.priceRepository.findPrices({ ids }, ids.length);

    return _.mapValues(_.keyBy(prices, 'id'), 'taxBehavior');
  }

  private async collectInvoiceItemLines(invoice: Invoice): Promise<InvoiceDraftLine[]> {
    const invoiceItems = await this.fastify.invoiceItemRepository.findInvoiceItems({
      customerId: invoice.customerId,
      currency: invoice.currency,
      pendingForInvoiceId: invoice.id,
    });

    const taxBehaviorByPriceId = await this.resolveTaxBehaviors(_.map(invoiceItems, 'priceId'));

    return _.map(invoiceItems, (invoiceItem): InvoiceDraftLine => {
      return {
        subscriptionItemId: null,
        subscriptionItemChangeId: null,
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
        taxRateIds: invoiceItem.taxRates,
        taxBehavior: _.get(
          taxBehaviorByPriceId,
          invoiceItem.priceId ?? '',
          TaxBehaviorEnum.UNSPECIFIED,
        ),
        periodStart: invoiceItem.periodStart,
        periodEnd: invoiceItem.periodEnd,
        prorationFactor: 1,
        isCredit: false,
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
    const createdAt = now.toISOString();
    const invoice = await this.fastify.invoiceRepository.createInvoice(
      {
        id,
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
        defaultTaxRates: subscription.defaultTaxRates,
        finalizedAt: null,
        paidAt: null,
        voidedAt: null,
        metadata: {},
        createdAt,
        updatedAt: createdAt,
      },
      tx,
    );

    if (invoice) {
      await this.recordInvoiceEvent(invoice, DomainEventTypeEnum.INVOICE_CREATED, tx);

      const lines = await this.buildSubscriptionLines(subscription, rated.lineItems);

      return this.writeFinalizedInvoice(invoice, lines, now, tx);
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
    const discountedLines = await this.fastify.discountService.applyDiscounts(invoice, lines, tx);
    const { lines: taxedLines, automaticTaxStatus } = await this.fastify.taxService.applyTaxes(
      invoice,
      customer,
      discountedLines,
    );
    const totals = InvoiceService.assembleInvoiceTotals(taxedLines, customer.balance);
    const finalizedAt = now.toISOString();
    const dueAt = this.resolveDueAt(invoice, now).toISOString();

    const lineItems = _.map(taxedLines, (line): NewInvoiceLineItem => {
      return {
        id: generateGid(ObjectPrefixEnum.INVOICE_LINE_ITEM),
        invoiceId: invoice.id,
        subscriptionItemId: line.subscriptionItemId,
        subscriptionItemChangeId: line.subscriptionItemChangeId,
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
        periodStart: line.periodStart,
        periodEnd: line.periodEnd,
        prorationFactor: line.prorationFactor,
        createdAt: finalizedAt,
      };
    });
    const taxAmounts = InvoiceService.buildLineItemTaxAmounts(
      invoice,
      taxedLines,
      lineItems,
      finalizedAt,
    );

    const sequenceValue = await this.fastify.numberSequenceRepository.claimNumberSequence(
      NumberSequenceEnum.INVOICE,
      tx,
    );

    if (sequenceValue === null) {
      throw new NotFoundError('Invoice number sequence is not provisioned');
    }

    await this.fastify.invoiceRepository.createInvoiceLineItems(lineItems, tx);
    await this.fastify.invoiceRepository.createInvoiceLineItemTaxAmounts(taxAmounts, tx);
    await this.markInvoicedWindows(invoice, taxedLines, tx);
    await this.fastify.invoiceItemRepository.attachInvoiceItems(
      _.compact(_.map(lines, 'invoiceItemId')),
      invoice.id,
      finalizedAt,
      tx,
    );

    const updatedInvoice = await this.fastify.invoiceRepository.updateInvoice(
      invoice.id,
      {
        number: InvoiceService.formatNumber(INVOICE_NUMBER_PREFIX, sequenceValue),
        status: InvoiceStatusEnum.OPEN,
        hostedInvoiceUrl: this.fastify.hostedUrlFactory.buildInvoiceUrl(invoice.id),
        invoicePdf: this.fastify.hostedUrlFactory.buildInvoicePdfUrl(invoice.id),
        ...totals,
        automaticTaxStatus,
        finalizedAt,
        dueAt,
        nextAttemptAt: InvoiceService.resolveNextAttemptAt(invoice, dueAt),
        updatedAt: finalizedAt,
      },
      tx,
    );

    if (updatedInvoice) {
      await this.applyCustomerBalance(updatedInvoice, totals, finalizedAt, tx);
      await this.postReceivable(updatedInvoice, totals, tx);
      await this.recordInvoiceEvent(updatedInvoice, DomainEventTypeEnum.INVOICE_FINALIZED, tx);

      return updatedInvoice;
    }

    throw new NotFoundError(`No such invoice: ${invoice.id}`);
  }

  private async markInvoicedWindows(
    invoice: Invoice,
    lines: readonly InvoiceDraftLine[],
    tx: DatabaseTransaction,
  ): Promise<void> {
    const { subscriptionId } = invoice;

    if (!subscriptionId) {
      return;
    }

    const subscription = await this.getSubscription(subscriptionId);

    if (subscription.billingMode === BillingModeEnum.ARREARS) {
      if (invoice.billingReason === BillingReasonEnum.SUBSCRIPTION_UPDATE) {
        await this.fastify.subscriptionRepository.markSubscriptionItemChangesInvoiced(
          _.compact(_.map(lines, 'subscriptionItemChangeId')),
          tx,
        );
      }

      return;
    }

    const chargesByPeriodEnd = _.groupBy(_.reject(lines, 'isCredit'), 'periodEnd');

    for (const [periodEnd, chargedLines] of _.toPairs(chargesByPeriodEnd)) {
      await this.fastify.subscriptionRepository.invoiceSubscriptionItemChanges(
        _.compact(_.map(chargedLines, 'subscriptionItemChangeId')),
        periodEnd,
        tx,
      );
    }

    await this.fastify.subscriptionRepository.markSubscriptionItemChangesInvoiced(
      _.compact(_.map(_.filter(lines, 'isCredit'), 'subscriptionItemChangeId')),
      tx,
    );
  }

  private static buildLineItemTaxAmounts(
    invoice: Invoice,
    lines: readonly InvoiceDraftLine[],
    lineItems: readonly NewInvoiceLineItem[],
    createdAt: string,
  ): NewInvoiceLineItemTaxAmount[] {
    return _.flatMap(lines, (line, index): NewInvoiceLineItemTaxAmount[] => {
      const lineItem = lineItems[index];

      if (!lineItem) {
        return [];
      }

      return _.map(line.taxAmounts, (taxAmount): NewInvoiceLineItemTaxAmount => {
        return {
          id: generateGid(ObjectPrefixEnum.INVOICE_LINE_TAX_AMOUNT),
          invoiceId: invoice.id,
          invoiceLineItemId: lineItem.id,
          taxRateId: taxAmount.taxRateId,
          amount: taxAmount.amount,
          taxableAmount: taxAmount.taxableAmount,
          isInclusive: taxAmount.isInclusive,
          percentage: taxAmount.percentage,
          taxType: taxAmount.taxType,
          createdAt,
        };
      });
    });
  }

  private static resolveNextAttemptAt(invoice: Invoice, dueAt: string): string | null {
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
        createdBeforeAt: finalizeBeforeAt.toISOString(),
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
    appliedAt: string,
    tx: DatabaseTransaction,
  ): Promise<void> {
    const movement = totals.endingBalance - totals.startingBalance;

    if (movement === 0) {
      return;
    }

    await this.fastify.customerRepository.updateCustomer(
      invoice.customerId,
      { balance: totals.endingBalance, updatedAt: appliedAt },
      tx,
    );

    await this.fastify.customerBalanceTransactionRepository.createCustomerBalanceTransaction(
      {
        id: generateGid(ObjectPrefixEnum.CUSTOMER_BALANCE_TRANSACTION),
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        creditNoteId: null,
        type: CustomerBalanceTransactionTypeEnum.APPLIED_TO_INVOICE,
        currency: invoice.currency,
        amount: movement,
        endingBalance: totals.endingBalance,
        description: `Applied to invoice ${invoice.number}`,
        metadata: {},
        createdAt: appliedAt,
      },
      tx,
    );
  }

  async payInvoice(
    id: string,
    payload: PayInvoicePayload,
    settlementReference?: string,
  ): Promise<InvoiceResponse> {
    const invoiceEntity = await this.getInvoiceEntity(id);
    const now = await this.fastify.clockService.resolveInvoiceNow(invoiceEntity);

    const paidInvoice = await this.fastify.database.master.transaction(async (tx) => {
      return this.settleInvoice(id, { amount: payload.amount, settlementReference }, now, tx);
    });

    return this.buildInvoice(paidInvoice);
  }

  async applyInvoicePayment(
    id: string,
    payload: ApplyInvoicePaymentPayload,
    tx: DatabaseTransaction,
  ): Promise<Invoice> {
    const invoiceEntity = await this.getInvoiceEntity(id);
    const now = await this.fastify.clockService.resolveInvoiceNow(invoiceEntity);

    return this.settleInvoice(id, payload, now, tx);
  }

  private async settleInvoice(
    id: string,
    payload: ApplyInvoicePaymentPayload,
    now: Date,
    tx: DatabaseTransaction,
  ): Promise<Invoice> {
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
    const paidAt = now.toISOString();

    const updatedInvoice = await this.fastify.invoiceRepository.updateInvoice(
      invoice.id,
      {
        amountPaid,
        attempted: true,
        status: isSettled ? InvoiceStatusEnum.PAID : invoice.status,
        paidAt: isSettled ? paidAt : null,
        nextAttemptAt: isSettled ? null : invoice.nextAttemptAt,
        updatedAt: paidAt,
      },
      tx,
    );

    if (updatedInvoice) {
      await this.fastify.invoiceRepository.createInvoicePayment(
        {
          id: generateGid(ObjectPrefixEnum.INVOICE_PAYMENT),
          invoiceId: invoice.id,
          paymentIntentId: payload.paymentIntentId ?? null,
          chargeId: payload.chargeId ?? null,
          amount,
          settlementReference: payload.settlementReference ?? null,
          paidAt,
          createdAt: paidAt,
        },
        tx,
      );

      if (!payload.chargeId) {
        await this.postCashReceipt(updatedInvoice, amount, payload.settlementReference, tx);
      }

      if (isSettled) {
        await this.recordInvoiceEvent(updatedInvoice, DomainEventTypeEnum.INVOICE_PAID, tx);
      }

      return updatedInvoice;
    }

    throw new NotFoundError(`No such invoice: ${invoice.id}`);
  }

  async voidInvoice(id: string, payload: VoidInvoicePayload): Promise<InvoiceResponse> {
    const invoice = await this.getInvoiceEntity(id);

    InvoiceService.assertTransition(invoice.status, InvoiceStatusEnum.VOID);

    if (invoice.amountPaid > 0) {
      throw new ConflictError(
        `Invoice ${id} has been paid and can only be corrected with a credit note`,
      );
    }

    const now = await this.fastify.clockService.resolveInvoiceNow(invoice);
    const voidedAt = now.toISOString();

    const voidedInvoice = await this.fastify.database.master.transaction(async (tx) => {
      const updatedInvoice = await this.fastify.invoiceRepository.updateInvoice(
        invoice.id,
        {
          status: InvoiceStatusEnum.VOID,
          voidedAt,
          metadata: { ...invoice.metadata, ...(payload.metadata ?? {}) },
          updatedAt: voidedAt,
        },
        tx,
      );

      if (updatedInvoice) {
        if (invoice.status === InvoiceStatusEnum.OPEN) {
          await this.reverseReceivable(updatedInvoice, tx);
          await this.restoreCustomerBalance(updatedInvoice, voidedAt, tx);
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

  async findInvoices(query: FindInvoicesQuery): Promise<ListResponse<InvoiceResponse>> {
    const { limit = DEFAULT_PAGE_LIMIT } = query;
    const beforeAt = await this.resolveCursor(query.startingAfter);
    const afterAt = await this.resolveCursor(query.endingBefore);
    const rows = await this.fastify.invoiceRepository.findInvoices(
      {
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
    const taxAmountsByLineItemId = await this.resolveLineItemTaxAmounts(invoiceIds);
    const creditedByInvoiceId = await this.resolveCreditedAmounts(invoiceIds);
    const refundedByInvoiceId = await this.resolveRefundedAmounts(invoiceIds);

    return {
      url: '/v1/invoices',
      hasMore: rows.length > limit,
      data: _.map(page, (invoice) => {
        const lineItems = _.get(lineItemsByInvoiceId, invoice.id, []);
        const amountCredited = _.get(creditedByInvoiceId, invoice.id, 0);
        const amountRefunded = _.get(refundedByInvoiceId, invoice.id, 0);

        return InvoiceService.buildInvoiceWithLineItems(
          invoice,
          lineItems,
          taxAmountsByLineItemId,
          amountCredited,
          amountRefunded,
        );
      }),
    };
  }

  private async reopenInvoicedItems(invoiceId: string, tx: DatabaseTransaction): Promise<void> {
    const lineItems = await this.fastify.invoiceRepository.findInvoiceLineItems([invoiceId]);
    const changeIds = _.compact(_.map(lineItems, 'subscriptionItemChangeId'));

    await this.fastify.subscriptionRepository.reopenSubscriptionItemChangeInvoicing(changeIds, tx);
  }

  private async findPeriodInvoice(
    subscription: Subscription,
    periodStart: string,
  ): Promise<Invoice | null> {
    const [invoice] = await this.fastify.invoiceRepository.findInvoices(
      {
        subscriptionId: subscription.id,
        billingReason: BillingReasonEnum.SUBSCRIPTION_CYCLE,
        periodStart,
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
        entries: _.filter(entries, (entry) => {
          return entry.amount > 0;
        }),
      },
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
        entries: _.filter(entries, (entry) => {
          return entry.amount > 0;
        }),
      },
      tx,
    );
  }

  private async restoreCustomerBalance(
    invoice: Invoice,
    unappliedAt: string,
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
      { balance: endingBalance, updatedAt: unappliedAt },
      tx,
    );

    await this.fastify.customerBalanceTransactionRepository.createCustomerBalanceTransaction(
      {
        id: generateGid(ObjectPrefixEnum.CUSTOMER_BALANCE_TRANSACTION),
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        creditNoteId: null,
        type: CustomerBalanceTransactionTypeEnum.UNAPPLIED_FROM_INVOICE,
        currency: invoice.currency,
        amount: -movement,
        endingBalance,
        description: `Unapplied from invoice ${invoice.number}`,
        metadata: {},
        createdAt: unappliedAt,
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

  private async resolveLineItemTaxAmounts(
    invoiceIds: readonly string[],
  ): Promise<Record<string, InvoiceLineItemTaxAmount[]>> {
    const rows = await this.fastify.invoiceRepository.findInvoiceLineItemTaxAmounts(invoiceIds);

    return _.groupBy(rows, 'invoiceLineItemId');
  }

  private async buildInvoice(invoice: Invoice): Promise<InvoiceResponse> {
    const lineItems = await this.fastify.invoiceRepository.findInvoiceLineItems([invoice.id]);
    const taxAmountsByLineItemId = await this.resolveLineItemTaxAmounts([invoice.id]);
    const creditedByInvoiceId = await this.resolveCreditedAmounts([invoice.id]);
    const refundedByInvoiceId = await this.resolveRefundedAmounts([invoice.id]);

    const amountCredited = _.get(creditedByInvoiceId, invoice.id, 0);
    const amountRefunded = _.get(refundedByInvoiceId, invoice.id, 0);

    return InvoiceService.buildInvoiceWithLineItems(
      invoice,
      lineItems,
      taxAmountsByLineItemId,
      amountCredited,
      amountRefunded,
    );
  }

  private async resolveCreditedAmounts(
    invoiceIds: readonly string[],
  ): Promise<Record<string, number>> {
    const rows = await this.fastify.creditNoteRepository.aggregateCreditedAmounts(invoiceIds, [
      CreditNoteStatusEnum.VOID,
    ]);

    return _.mapValues(_.keyBy(rows, 'invoiceId'), 'creditedAmount');
  }

  private async resolveRefundedAmounts(
    invoiceIds: readonly string[],
  ): Promise<Record<string, number>> {
    const rows = await this.fastify.refundRepository.aggregateRefundedAmounts(invoiceIds, [
      RefundStatusEnum.SUCCEEDED,
    ]);

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
    taxAmountsByLineItemId: Record<string, InvoiceLineItemTaxAmount[]>,
    amountCredited: number,
    amountRefunded: number,
  ): InvoiceResponse {
    return {
      ...invoice,
      automaticTax: {
        enabled: invoice.automaticTaxEnabled,
        status: invoice.automaticTaxStatus,
      },
      amountCredited,
      amountRefunded,
      amountRemaining: invoice.amountDue - invoice.amountPaid - amountCredited,
      lineItems: _.map(lineItems, (lineItem) => {
        return {
          ...lineItem,
          taxAmounts: _.get(taxAmountsByLineItemId, lineItem.id, []),
        };
      }),
    };
  }
}
